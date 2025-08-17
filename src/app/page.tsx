"use client";

import { useState } from "react";
import { FileText, Loader2, Sparkles, PencilRuler, Eye } from "lucide-react";

import type { SurveyQuestion } from "@/types";
import { handleGenerateSurvey } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Logo from "@/components/logo";
import SurveyGeneratorForm from "@/components/survey-generator-form";
import SurveyBuilder from "@/components/survey-builder";
import SurveyPreview from "@/components/survey-preview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Home() {
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [surveyTitle, setSurveyTitle] = useState("Your Awesome Survey");
  const [activeTab, setActiveTab] = useState("generator");
  const { toast } = useToast();

  const handleSurveyGeneration = async (data: {
    prompt: string;
    userInstructions: string;
    exampleInputs: string;
    questionBankContent: string;
  }) => {
    setIsLoading(true);
    setQuestions([]);
    setSurveyTitle(data.prompt || "Generated Survey");

    try {
      const result = await handleGenerateSurvey(data);
      if (result && result.surveyQuestions.length > 0) {
        setQuestions(
          result.surveyQuestions.map((q, i) => ({
            id: `q-${Date.now()}-${i}`,
            text: q,
          }))
        );
        toast({
          title: "Survey Generated!",
          description: "Your survey is ready for review.",
        });
        setActiveTab("builder");
      } else {
        toast({
          variant: "destructive",
          title: "Generation Failed",
          description: "The AI could not generate a survey from the prompt. Please try again or refine your input.",
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "An Error Occurred",
        description: "Something went wrong. Please check the console and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const LoadingState = () => (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
      <h2 className="text-xl font-semibold mb-2">Generating your survey...</h2>
      <p className="text-muted-foreground">The AI is crafting your questions. This may take a moment.</p>
      <div className="w-full max-w-2xl mt-8 space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-muted/20">
      <header className="flex items-center justify-between p-4 border-b bg-background">
        <Logo />
        <Tabs value={activeTab} onValueChange={setActiveTab} className="hidden md:block">
          <TabsList>
            <TabsTrigger value="generator">
              <Sparkles className="mr-2" /> Generator
            </TabsTrigger>
            <TabsTrigger value="builder" disabled={questions.length === 0}>
              <PencilRuler className="mr-2" /> Builder
            </TabsTrigger>
            <TabsTrigger value="preview" disabled={questions.length === 0}>
              <Eye className="mr-2" /> Preview
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="w-40" />
      </header>

      <main className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsContent value="generator" className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-2xl mx-auto">
              <SurveyGeneratorForm
                onGenerateSurvey={handleSurveyGeneration}
                isLoading={isLoading}
              />
            </div>
          </TabsContent>
          <TabsContent value="builder" className="flex-1 overflow-y-auto p-4 md:p-8">
             {isLoading ? <LoadingState /> : (
              <div className="max-w-4xl mx-auto">
                <SurveyBuilder
                  title={surveyTitle}
                  questions={questions}
                  setQuestions={setQuestions}
                />
              </div>
             )}
          </TabsContent>
          <TabsContent value="preview" className="flex-1 overflow-y-auto p-4 md:p-8 bg-muted/40">
            <div className="max-w-2xl mx-auto">
              <SurveyPreview title={surveyTitle} questions={questions} />
            </div>
          </TabsContent>

          <div className="block md:hidden p-2 border-t bg-background">
             <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="generator">
                  <Sparkles />
                </TabsTrigger>
                <TabsTrigger value="builder" disabled={questions.length === 0}>
                  <PencilRuler />
                </TabsTrigger>
                <TabsTrigger value="preview" disabled={questions.length === 0}>
                  <Eye />
                </TabsTrigger>
              </TabsList>
          </div>
        </Tabs>
      </main>
    </div>
  );
}
