
"use client";

import { useState, useEffect, useMemo } from 'react';
import type { SavedSurvey, SurveyResult } from '@/types';
import { getSurveyResults } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2, User, ChevronDown, PieChart as PieIcon, LineChart as LineIcon, BarChart as BarIcon, Smartphone, Laptop, MapPin, Clock } from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Pie, Cell, Line, LineChart, PieChart, BarChart } from "recharts"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { format } from 'date-fns';
import PersonalizedAnswersDisplay from './personalized-answers-display';
import { getPreciseLocation } from '@/lib/utils';


type SurveyResultsProps = {
  survey: SavedSurvey;
  onBack: () => void;
};

type Submission = {
  id: string;
  userName: string;
  createdAt: string;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  country?: string | null;
  device_type?: string | null;
  preciseLocation?: string | null;
  answers: {
    questionId: string;
    questionText: string;
    answerValue: string;
    timeTakenSeconds?: number | null;
    questionStartedAt?: string | null;
    questionAnsweredAt?: string | null;
  }[];
};

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

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
    if (!results || results.length === 0) {
      return [];
    }
    const groupedBySubmission = results.reduce((acc, result) => {
      if (!acc[result.submission_id]) {
        acc[result.submission_id] = {
          id: result.submission_id,
          userName: result.user_name || 'Anonymous',
          createdAt: result.submission_created_at,
          latitude: result.latitude,
          longitude: result.longitude,
          city: result.city,
          country: result.country,
          device_type: result.device_type,
          preciseLocation: null, // Will be populated later
          answers: [],
        };
      }
      acc[result.submission_id].answers.push({
        questionId: result.question_id,
        questionText: result.question_text,
        answerValue: result.answer_value,
        timeTakenSeconds: result.time_taken_seconds,
        questionStartedAt: result.question_started_at,
        questionAnsweredAt: result.question_answered_at,
      });
      return acc;
    }, {} as Record<string, Submission>);

    return Object.values(groupedBySubmission).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [results]);

  // Fetch precise locations for submissions with GPS coordinates
  useEffect(() => {
    const fetchPreciseLocations = async () => {
      const submissionsWithGPS = submissions.filter(sub => sub.latitude && sub.longitude && !sub.preciseLocation);

      for (const submission of submissionsWithGPS) {
        try {
          const preciseLocation = await getPreciseLocation(submission.latitude!, submission.longitude!);
          submission.preciseLocation = preciseLocation;
        } catch (error) {
          console.error('Error fetching precise location:', error);
          submission.preciseLocation = `${submission.latitude?.toFixed(6)}, ${submission.longitude?.toFixed(6)}`;
        }
      }
    };

    if (submissions.length > 0) {
      fetchPreciseLocations();
    }
  }, [submissions]);


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
      if (question.data) {
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
                            {sub.device_type === 'mobile' ? <Smartphone className="h-4 w-4 text-muted-foreground" /> : sub.device_type === 'desktop' ? <Laptop className="h-4 w-4 text-muted-foreground" /> : null}
                            <p className="font-medium">{sub.userName}</p>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>{format(new Date(sub.createdAt), "PPP p")}</p>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3 w-3" />
                              <span>
                                {sub.preciseLocation || sub.city || 'Unknown Location'}
                                {sub.latitude && sub.longitude && (
                                  <span className="text-xs ml-2">
                                    ({sub.latitude.toFixed(6)}, {sub.longitude.toFixed(6)})
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                        <ChevronDown className="h-5 w-5 transition-transform [&[data-state=open]]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="p-4 border-t">
                          <ul className="space-y-4">
                            {sub.answers.map((ans, i) => (
                              <li key={i} className="text-sm">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <strong className="font-medium">{ans.questionText}</strong>
                                    <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{ans.answerValue}</p>
                                  </div>
                                  {ans.timeTakenSeconds && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground ml-4">
                                      <Clock className="h-3 w-3" />
                                      <span>{ans.timeTakenSeconds}s</span>
                                    </div>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                          {survey.has_personalized_questions && <PersonalizedAnswersDisplay submissionId={sub.id} />}
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

