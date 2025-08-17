
"use client";

import { useState, useEffect, useMemo } from 'react';
import type { SavedSurvey, SurveyResult } from '@/types';
import { getSurveyResults } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2, BarChartHorizontalBig, User, ChevronDown } from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { format } from 'date-fns';


type SurveyResultsProps = {
  survey: SavedSurvey;
  onBack: () => void;
};

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];


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
    
    Object.values(grouped).forEach(submission => {
        submission.answers.sort((a, b) => {
            const qA_index = survey.questions.findIndex(q => q.id === a.questionId);
            const qB_index = survey.questions.findIndex(q => q.id === b.questionId);
            return qA_index - qB_index;
        });
    });

    return Object.values(grouped).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [results, survey.questions]);

  const aggregatedResults = useMemo(() => {
    return survey.questions.map(question => {
        const questionResults = results.filter(r => r.question_id === question.id);
        
        let data: { name: string; value: number, fill: string }[] = [];

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
            const counts: Record<string, number> = {};
             questionResults.forEach(r => {
                const num = r.answer_value;
                counts[num] = (counts[num] || 0) + 1;
            });
            data = Object.entries(counts)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([name, value], index) => ({ name, value, fill: COLORS[index % COLORS.length] }));
        }
        
        return {
            ...question,
            totalSubmissions: questionResults.length,
            data,
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
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><BarChartHorizontalBig />Charts</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       {aggregatedResults.filter(q => q.totalSubmissions > 0 && q.type !== 'text').map(question => (
                           <Card key={question.id}>
                               <CardHeader>
                                   <CardTitle className="text-base">{question.text}</CardTitle>
                               </CardHeader>
                               <CardContent>
                                   <ChartContainer config={chartConfig} className="min-h-60 w-full">
                                         <ResponsiveContainer width="100%" height={Math.max(240, question.data.length * 40)}>
                                             <BarChart data={question.data} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis type="number" allowDecimals={false} />
                                                <YAxis dataKey="name" type="category" width={100} interval={0} style={{ fontSize: '0.8rem', whiteSpace: 'normal', wordWrap: 'break-word' }}/>
                                                <Tooltip
                                                  cursor={{fill: 'hsl(var(--muted))'}}
                                                  content={<ChartTooltipContent />}
                                                />
                                                <Bar dataKey="value" name="Count" radius={4}>
                                                  {question.data.map(d => <Cell key={d.name} fill={d.fill} />)}
                                                </Bar>
                                            </BarChart>
                                         </ResponsiveContainer>
                                   </ChartContainer>
                               </CardContent>
                           </Card>
                       ))}
                   </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><User />Individual Submissions</h3>
                <div className="space-y-4">
                  {submissions.map(sub => (
                    <Collapsible key={sub.id} className="border rounded-lg">
                      <CollapsibleTrigger className="w-full p-4 flex justify-between items-center cursor-pointer hover:bg-muted/50 rounded-t-lg">
                         <div className="text-left">
                           <p className="font-medium">{sub.userName}</p>
                           <p className="text-sm text-muted-foreground">{format(new Date(sub.createdAt), "PPP p")}</p>
                         </div>
                         <ChevronDown className="h-5 w-5 transition-transform [&[data-state=open]]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                          <div className="p-4 border-t">
                            <ul className="space-y-4">
                              {sub.answers.map((ans, i) => (
                                <li key={i} className="text-sm">
                                  <strong className="font-medium">{ans.questionText}</strong>
                                  <p className="text-muted-foreground mt-1">{ans.answerValue}</p>
                                </li>
                              ))}
                            </ul>
                          </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
