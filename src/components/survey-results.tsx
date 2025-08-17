
"use client";

import { useState, useEffect, useMemo } from 'react';
import type { SavedSurvey, SurveyResult, PersonalizedAnswer } from '@/types';
import { getSurveyResults } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2, User, ChevronDown, PieChart as PieIcon, LineChart as LineIcon, BarChart as BarIcon, Smartphone, Laptop, Sparkles } from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Pie, Cell, Line, LineChart, PieChart, BarChart } from "recharts"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { format } from 'date-fns';
import { Separator } from './ui/separator';


type SurveyResultsProps = {
  survey: SavedSurvey;
  onBack: () => void;
};

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

type Submission = {
  id: string;
  userName: string;
  createdAt: string;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  country?: string | null;
  device_type?: string | null;
  answers: {
    questionId: string;
    questionText: string;
    answerValue: string;
  }[];
  personalizedAnswers: PersonalizedAnswer[];
};


export default function SurveyResults({ survey, onBack }: SurveyResultsProps) {
  const [results, setResults] = useState<SurveyResult[]>([]);
  const [personalizedResults, setPersonalizedResults] = useState<PersonalizedAnswer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchResults = async () => {
      setIsLoading(true);
      const { data, personalizedData, error } = await getSurveyResults(survey.id);
      if (error) {
        toast({ variant: "destructive", title: "Error", description: "Could not fetch survey results." });
      } else {
        setResults(data || []);
        setPersonalizedResults(personalizedData || []);
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
        latitude: result.latitude,
        longitude: result.longitude,
        city: result.city,
        country: result.country,
        device_type: result.device_type,
        answers: [],
        personalizedAnswers: [], // Initialize personalized answers
      };
      acc[result.submission_id].answers.push({
        questionId: result.question_id,
        questionText: result.question_text,
        answerValue: result.answer_value,
      });
      return acc;
    }, {} as Record<string, Submission>);
    
    // Add personalized answers to the corresponding submission
    personalizedResults.forEach(pAns => {
      if (grouped[pAns.submission_id]) {
        grouped[pAns.submission_id].personalizedAnswers.push(pAns);
      }
    });

    Object.values(grouped).forEach(submission => {
        submission.answers.sort((a, b) => {
            const qA_index = survey.questions.findIndex(q => q.id === a.questionId);
            const qB_index = survey.questions.findIndex(q => q.id === b.questionId);
            return qA_index - qB_index;
        });
    });

    return Object.values(grouped).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [results, personalizedResults, survey.questions]);

  const aggregatedResults = useMemo(() => {
    return survey.questions.map(question => {
        const questionResults = results.filter(r => r.question_id === question.id);
        
        let data: { name: string; value: number, fill?: string }[] = [];

        if (question.type === 'yes-no' || question.type === 'multiple-choice' || question.type === 'multiple-choice-multi') {
            const counts: Record<string, number> = {};
            
            const allOptions = question.type === 'yes-no' ? ['Yes', 'No'] : question.options?.map(o => o.text) || [];
            allOptions.forEach(opt => counts[opt] = 0);

            questionResults.forEach(r => {
                try {
                    const answers = (question.type === 'multiple-choice-multi' || question.type === 'multiple-choice') && r.answer_value.startsWith('[') ? JSON.parse(r.answer_value) : [r.answer_value];
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
            data = Object.entries(counts).map(([name, value]) => ({ name, value }));
        } else if (question.type === 'number') {
            data = questionResults
                .map((r, index) => ({ name: `Sub. ${index + 1}`, value: Number(r.answer_value) || 0 }))
                .sort((a, b) => a.value - b.value);
        }
        
        return {
            ...question,
            totalSubmissions: questionResults.length,
            data,
        };
    });
  }, [survey, results]);
  
  const deviceTypeData = useMemo(() => {
    const counts = submissions.reduce((acc, sub) => {
        const device = sub.device_type || 'Unknown';
        acc[device] = (acc[device] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [submissions])


  const chartConfig = useMemo(() => {
    const config: any = {};
    aggregatedResults.forEach(question => {
        if(question.data) {
            question.data.forEach((d, i) => {
                config[d.name] = {
                    label: d.name,
                    color: COLORS[i % COLORS.length]
                }
            })
        }
    });
     config.value = { label: 'Value', color: "hsl(var(--chart-1))" };
     config.desktop = { label: 'Desktop', color: "hsl(var(--chart-1))" };
     config.mobile = { label: 'Mobile', color: "hsl(var(--chart-2))" };
     config.Unknown = { label: 'Unknown', color: "hsl(var(--chart-3))" };
    return config;
  }, [aggregatedResults]);

  const renderChart = (question: (typeof aggregatedResults)[0]) => {
     if (question.totalSubmissions === 0) {
        return <p className="text-center text-muted-foreground py-8">No data for this question yet.</p>;
     }

     switch (question.type) {
         case 'yes-no':
            return (
                <ChartContainer config={chartConfig} className="min-h-60 w-full">
                    <BarChart data={question.data} layout="vertical">
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} />
                        <Tooltip content={<ChartTooltipContent indicator="line" />} />
                        <Bar dataKey="value" radius={5}>
                             {question.data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={chartConfig[entry.name]?.color || COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ChartContainer>
            )
         case 'multiple-choice':
         case 'multiple-choice-multi':
            return (
                <ChartContainer config={chartConfig} className="min-h-60 w-full aspect-square">
                    <PieChart>
                        <Tooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                        <Pie data={question.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                           {question.data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={chartConfig[entry.name]?.color || COLORS[index % COLORS.length]} />
                           ))}
                        </Pie>
                        <Legend />
                    </PieChart>
                </ChartContainer>
            );
        case 'number':
            return (
                 <ChartContainer config={chartConfig} className="min-h-60 w-full">
                    <LineChart data={question.data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip content={<ChartTooltipContent indicator="line" />} />
                        <Legend />
                        <Line type="monotone" dataKey="value" stroke="hsl(var(--chart-1))" activeDot={{ r: 8 }} />
                    </LineChart>
                </ChartContainer>
            )
        default:
            return null;
     }
  }


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
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">Charts</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <Card>
                           <CardHeader>
                               <CardTitle className="text-base flex items-center gap-2">
                                   <BarIcon className="h-5 w-5 text-muted-foreground" />
                                   Submissions by Device
                                </CardTitle>
                           </CardHeader>
                           <CardContent>
                                <ChartContainer config={chartConfig} className="min-h-60 w-full">
                                    <PieChart>
                                        <Tooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                                        <Pie data={deviceTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                        {deviceTypeData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={chartConfig[entry.name]?.color || COLORS[index % COLORS.length]} />
                                        ))}
                                        </Pie>
                                        <Legend />
                                    </PieChart>
                                </ChartContainer>
                           </CardContent>
                       </Card>

                       {aggregatedResults.filter(q => q.type !== 'text').map(question => (
                           <Card key={question.id}>
                               <CardHeader>
                                   <CardTitle className="text-base flex items-center gap-2">
                                       {question.type === 'number' && <LineIcon className="h-5 w-5 text-muted-foreground" />}
                                       {(question.type === 'yes-no' || question.type.startsWith('multiple-choice')) && <PieIcon className="h-5 w-5 text-muted-foreground" />}
                                       {question.text}
                                    </CardTitle>
                               </CardHeader>
                               <CardContent>
                                    <ResponsiveContainer width="100%" height={300}>
                                        {renderChart(question)}
                                    </ResponsiveContainer>
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
                      <CollapsibleTrigger className="w-full p-4 flex justify-between items-center cursor-pointer hover:bg-muted/50 rounded-t-lg data-[state=open]:bg-muted/50">
                         <div className="text-left">
                           <div className="flex items-center gap-2">
                            {sub.device_type === 'mobile' ? <Smartphone className="h-4 w-4 text-muted-foreground"/> : sub.device_type === 'desktop' ? <Laptop className="h-4 w-4 text-muted-foreground"/> : null}
                            <p className="font-medium">{sub.userName}</p>
                           </div>
                           <p className="text-sm text-muted-foreground">{format(new Date(sub.createdAt), "PPP p")} &bull; {sub.city || 'Unknown Location'}</p>
                         </div>
                         <ChevronDown className="h-5 w-5 transition-transform [&[data-state=open]]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                          <div className="p-4 border-t">
                            <ul className="space-y-4">
                              {sub.answers.map((ans, i) => (
                                <li key={i} className="text-sm">
                                  <strong className="font-medium">{ans.questionText}</strong>
                                  <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{ans.answerValue}</p>
                                </li>
                              ))}
                            </ul>
                            {sub.personalizedAnswers && sub.personalizedAnswers.length > 0 && (
                                <>
                                 <Separator className="my-4" />
                                 <div className="space-y-4">
                                    <h4 className="text-sm font-semibold flex items-center gap-2">
                                        <Sparkles className="h-4 w-4 text-primary" />
                                        Personalized Follow-up
                                    </h4>
                                    <ul className="space-y-4">
                                     {sub.personalizedAnswers.map((pAns) => (
                                        <li key={pAns.id} className="text-sm">
                                            <strong className="font-medium">{pAns.question_text}</strong>
                                            <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{pAns.answer_text}</p>
                                        </li>
                                     ))}
                                    </ul>
                                 </div>
                                </>
                            )}
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
