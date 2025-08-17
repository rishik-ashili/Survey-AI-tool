
"use client";

import { useState, useEffect, useMemo } from 'react';
import type { SavedSurvey, SurveyResult, QuestionType } from '@/types';
import { getSurveyResults } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Loader2, BarChartHorizontalBig, PieChart, User } from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import { Bar, BarChart, Pie, ResponsiveContainer, Cell, PieLabel } from "recharts"

type SurveyResultsProps = {
  survey: SavedSurvey;
  onBack: () => void;
};

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

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
        questionText: result.question_text,
        answerValue: result.answer_value,
      });
      return acc;
    }, {} as Record<string, { id: string; userName: string; createdAt: string; answers: { questionText: string; answerValue: string }[] }>);
    
    return Object.values(grouped);
  }, [results]);

  const aggregatedResults = useMemo(() => {
    return survey.questions.map(question => {
        const questionResults = results.filter(r => r.question_id === question.id);
        
        let data: { name: string; value: number }[] = [];
        let total = 0;

        if (question.type === 'yes-no' || question.type === 'multiple-choice') {
            const counts: Record<string, number> = {};
            questionResults.forEach(r => {
                try {
                    const answers = question.type === 'multiple-choice' ? JSON.parse(r.answer_value) : [r.answer_value];
                    (answers as string[]).forEach(ans => {
                        counts[ans] = (counts[ans] || 0) + 1;
                    });
                } catch {
                   // Handle non-JSON values for multiple-choice if any
                   counts[r.answer_value] = (counts[r.answer_value] || 0) + 1
                }
            });
            data = Object.entries(counts).map(([name, value]) => ({ name, value }));
        } else if (question.type === 'number') {
            const numbers = questionResults.map(r => Number(r.answer_value)).filter(n => !isNaN(n));
            const avg = numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
            data = [{ name: 'Average', value: parseFloat(avg.toFixed(2)) }];
        }
        
        return {
            ...question,
            totalSubmissions: questionResults.length,
            data,
        };
    });
  }, [survey, results]);


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
                       {aggregatedResults.filter(q => q.type !== 'text').map(question => (
                           <Card key={question.id}>
                               <CardHeader>
                                   <CardTitle className="text-base">{question.text}</CardTitle>
                               </CardHeader>
                               <CardContent>
                                   <ChartContainer config={{}} className="h-60">
                                       <ResponsiveContainer width="100%" height="100%">
                                        {question.type === 'number' ? (
                                             <BarChart data={question.data} layout="vertical" margin={{ left: 20, right: 20 }}>
                                                <Bar dataKey="value" fill="var(--color-primary)" radius={4} barSize={30} />
                                                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                                            </BarChart>
                                        ) : (
                                            <PieChart>
                                                <Pie data={question.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                                    {question.data.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                                                <ChartLegend content={<ChartLegendContent />} />
                                            </PieChart>
                                        )}
                                       </ResponsiveContainer>
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
                        <TableHead>User</TableHead>
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

