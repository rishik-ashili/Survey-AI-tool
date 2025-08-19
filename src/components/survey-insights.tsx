"use client";

import { useState } from 'react';
import { handleGenerateSurveyInsights } from '@/app/actions';
import type { SurveyInsightsOutput } from '@/ai/flows/survey-insights-flow';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Separator } from './ui/separator';
import { Brain, Loader2, TrendingUp, Users, MessageSquare, Lightbulb, BarChart3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";

type SurveyInsightsProps = {
    surveyId: string;
    surveyTitle: string;
};

export default function SurveyInsights({ surveyId, surveyTitle }: SurveyInsightsProps) {
    const [insights, setInsights] = useState<SurveyInsightsOutput | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerated, setIsGenerated] = useState(false);
    const { toast } = useToast();

    const generateInsights = async () => {
        setIsLoading(true);
        const { data, error } = await handleGenerateSurveyInsights(surveyId);

        if (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Could not generate insights. Please try again.",
            });
        } else {
            setInsights(data);
            setIsGenerated(true);
        }
        setIsLoading(false);
    };

    const getCategoryIcon = (category: string) => {
        switch (category.toLowerCase()) {
            case 'demographics':
                return <Users className="h-4 w-4" />;
            case 'preferences':
                return <TrendingUp className="h-4 w-4" />;
            case 'trends':
                return <BarChart3 className="h-4 w-4" />;
            default:
                return <MessageSquare className="h-4 w-4" />;
        }
    };

    if (!isGenerated) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-primary" />
                        AI Insights
                    </CardTitle>
                    <CardDescription>
                        Generate detailed AI-powered analysis and insights from your survey results
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button
                        onClick={generateInsights}
                        disabled={isLoading}
                        className="w-full"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Analyzing Results...
                            </>
                        ) : (
                            <>
                                <Brain className="mr-2 h-4 w-4" />
                                Generate AI Insights
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (!insights) {
        return null;
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-primary" />
                        AI Insights for "{surveyTitle}"
                    </CardTitle>
                    <CardDescription>
                        AI-powered analysis of your survey results
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Overall Summary */}
                    <div>
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-primary" />
                            Executive Summary
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">{insights.summary}</p>
                    </div>

                    <Separator />

                    {/* Detailed Insights */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Detailed Analysis</h3>
                        <div className="space-y-4">
                            {insights.insights.map((insight, index) => (
                                <Collapsible key={index}>
                                    <CollapsibleTrigger className="w-full">
                                        <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                                            <CardHeader className="pb-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        {getCategoryIcon(insight.category)}
                                                        <div className="text-left">
                                                            <CardTitle className="text-base">{insight.title}</CardTitle>
                                                            <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-md mt-1">
                                                                {insight.category}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                        </Card>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <Card className="mt-2">
                                            <CardContent className="pt-4">
                                                <p className="text-muted-foreground mb-4">{insight.description}</p>
                                                <div>
                                                    <h4 className="font-medium mb-2">Key Findings:</h4>
                                                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                                                        {insight.keyFindings.map((finding, idx) => (
                                                            <li key={idx}>{finding}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </CollapsibleContent>
                                </Collapsible>
                            ))}
                        </div>
                    </div>

                    <Separator />

                    {/* Demographic Analysis */}
                    <div>
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                            <Users className="h-5 w-5 text-primary" />
                            Demographic Analysis
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">{insights.demographicAnalysis}</p>
                    </div>

                    <Separator />

                    {/* Sentiment Analysis */}
                    <div>
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-primary" />
                            Sentiment & Perception Analysis
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">{insights.sentimentAnalysis}</p>
                    </div>

                    <Separator />

                    {/* Recommendations */}
                    <div>
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                            <Lightbulb className="h-5 w-5 text-primary" />
                            Recommendations
                        </h3>
                        <ul className="space-y-2">
                            {insights.recommendations.map((recommendation, index) => (
                                <li key={index} className="flex items-start gap-2">
                                    <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                                    <p className="text-muted-foreground">{recommendation}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
