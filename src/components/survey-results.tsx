
"use client";

import { useState, useEffect, useMemo } from 'react';
import type { SavedSurvey, SurveyResult, QuestionType } from '@/types';
import { getSurveyResults } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Loader2, BarChartHorizontalBig, PieChart, User, Cloud, Tags } from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import { Bar, BarChart, Pie, ResponsiveContainer, Cell, XAxis, YAxis } from "recharts"
import { Badge } from './ui/badge';

type SurveyResultsProps = {
  survey: SavedSurvey;
  onBack: () => void;
};

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const TopWords = ({ words }: { words: { text: string; value: number }[] }) => {
  if (!words || words.length === 0) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">No text responses yet.</div>;
  }

  return (
    <div className="flex flex-wrap gap-2 items-center justify-center h-full">
      {words.map((word, index) => (
        <Badge key={index} variant="secondary" className="text-base px-3 py-1">
          {word.text} 
          <span className="ml-2 font-mono text-xs opacity-70">{word.value}</span>
        </Badge>
      ))}
    </div>
  );
};


export default function SurveyResults({ survey, onBack }: SurveyResultsProps) {
  const [results, setResults] = useState<SurveyResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchResults = async () => {
      setIsLoading(true);
      const { data, error } = await getSurveyResults(survey.id);
      if (error) {
        toast({ variant: "destructive", title: "Error", description: "Could not fetch survey results." });
      } else {
        setResults(data || []);
      }
      setIsLoading(false);
    };
    fetchResults();
  }, [survey.id, toast]);

  const submissions = useMemo(() => {
    const grouped = results.reduce((acc, result) => {
      acc[result.submission_id] = acc[result.submission_id] || {
        id: result.submission_id,
        userName: result.user_name || 'Anonymous',
        createdAt: result.submission_created_at,
        answers: [],
      };
      acc[result.submission_id].answers.push({
        questionId: result.question_id,
        questionText: result.question_text,
        answerValue: result.answer_value,
      });
      return acc;
    }, {} as Record<string, { id: string; userName: string; createdAt: string; answers: { questionId: string, questionText: string; answerValue: string }[] }>);
    
    // Sort answers based on original question order
    Object.values(grouped).forEach(submission => {
        submission.answers.sort((a, b) => {
            const qA_index = survey.questions.findIndex(q => q.id === a.questionId);
            const qB_index = survey.questions.findIndex(q => q.id === b.questionId);
            return qA_index - qB_index;
        });
    });

    return Object.values(grouped);
  }, [results, survey.questions]);

  const aggregatedResults = useMemo(() => {
    return survey.questions.map(question => {
        const questionResults = results.filter(r => r.question_id === question.id);
        
        let data: { name: string; value: number, fill: string }[] = [];
        let topWords: {text: string, value: number}[] = [];

        if (question.type === 'yes-no' || question.type === 'multiple-choice') {
            const counts: Record<string, number> = {};
            
            const allOptions = question.type === 'yes-no' ? ['yes', 'no'] : question.options?.map(o => o.text) || [];
            allOptions.forEach(opt => counts[opt] = 0);


            questionResults.forEach(r => {
                try {
                    const answers = question.type === 'multiple-choice' && r.answer_value.startsWith('[') ? JSON.parse(r.answer_value) : [r.answer_value];
                    (answers as string[]).forEach(ans => {
                        if (counts[ans] !== undefined) {
                            counts[ans]++;
                        } else {
                            counts[ans] = 1;
                        }
                    });
                } catch {
                   if (counts[r.answer_value] !== undefined) {
                       counts[r.answer_value]++;
                   } else {
                       counts[r.answer_value] = 1;
                   }
                }
            });
            data = Object.entries(counts).map(([name, value], index) => ({ name: name, value, fill: COLORS[index % COLORS.length] }));
        } else if (question.type === 'number') {
            const numbers = questionResults.map(r => Number(r.answer_value)).filter(n => !isNaN(n));
            const avg = numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
            data = [{ name: 'Average', value: parseFloat(avg.toFixed(2)), fill: COLORS[0] }];
        } else if (question.type === 'text') {
            const wordCounts: Record<string, number> = {};
            const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'in', 'it', 'of', 'and', 'to', 'for', 'i', 'was', 'with']);
            questionResults.forEach(r => {
                // simple word tokenization
                r.answer_value.toLowerCase().split(/\s+/).forEach(word => {
                    const cleanWord = word.replace(/[^a-zA-Z]/g, ''); // remove punctuation
                    if (cleanWord.length > 2 && !stopWords.has(cleanWord)) { 
                        wordCounts[cleanWord] = (wordCounts[cleanWord] || 0) + 1;
                    }
                })
            });
            topWords = Object.entries(wordCounts)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 10) // Take top 10 for more variety
              .map(([text, value]) => ({text, value}));
        }
        
        return {
            ...question,
            totalSubmissions: questionResults.length,
            data,
            topWords,
        };
    });
  }, [survey, results]);

  const chartConfig = useMemo(() => {
    const config: any = {};
    aggregatedResults.forEach(question => {
        if(question.data) {
            question.data.forEach(d => {
                config[d.name] = {
                    label: d.name,
                    color: d.fill
                }
            })
        }
    });
    return config;
  }, [aggregatedResults]);


  return (
    <div className="space-y-6">
      <Button onClick={onBack} variant="ghost" className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Saved Surveys
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Results for: {survey.title}</CardTitle>
          <CardDescription>
            {submissions.length} submission(s) so far.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
          ) : submissions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No results yet.</p>
          ) : (
            <div className="space-y-8">
              <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><PieChart />Charts</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       {aggregatedResults.filter(q => q.totalSubmissions > 0).map(question => (
                           <Card key={question.id}>
                               <CardHeader>
                                   <CardTitle className="text-base">{question.text}</CardTitle>
                               </CardHeader>
                               <CardContent>
                                   <ChartContainer config={chartConfig} className="h-60">
                                     {question.type === 'text' ? (
                                        <TopWords words={question.topWords} />
                                     ) : question.type === 'number' ? (
                                         <ResponsiveContainer width="100%" height="100%">
                                             <BarChart data={question.data} layout="vertical" margin={{ left: 10, right: 40 }}>
                                                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} />
                                                <XAxis type="number" hide />
                                                <Bar dataKey="value" radius={4} barSize={30}>
                                                  {question.data.map(d => <Cell key={d.name} fill={d.fill} />)}
                                                </Bar>
                                                <ChartTooltip 
                                                  cursor={false}
                                                  content={<ChartTooltipContent hideLabel />} 
                                                />
                                            </BarChart>
                                         </ResponsiveContainer>
                                     ) : (
                                         <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={question.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                                    {question.data.map((entry) => (
                                                        <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                                                    ))}
                                                </Pie>
                                                <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                                                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                                            </PieChart>
                                         </ResponsiveContainer>
                                     )}
                                   </ChartContainer>
                               </CardContent>
                           </Card>
                       ))}
                   </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><User />Individual Submissions</h3>
                <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead className="w-1/4">User</TableHead>
                        <TableHead>Answers</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {submissions.map(sub => (
                        <TableRow key={sub.id}>
                            <TableCell className="font-medium align-top">
                                {sub.userName}
                                <div className="text-xs text-muted-foreground">{new Date(sub.createdAt).toLocaleString()}</div>
                            </TableCell>
                            <TableCell>
                                <ul className="space-y-2">
                                    {sub.answers.map((ans, i) => (
                                        <li key={i} className="text-sm">
                                            <strong className="font-medium">{ans.questionText}</strong>
                                            <p className="text-muted-foreground">{ans.answerValue}</p>
                                        </li>
                                    ))}
                                </ul>
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
