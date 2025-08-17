"use client";

import { useState } from "react";
import { FileText, Loader2, Sparkles } from "lucide-react";

import type { SurveyQuestion } from "@/types";
import { handleGenerateSurvey } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { Sidebar, SidebarContent, SidebarHeader, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Logo from "@/components/logo";
import SurveyGeneratorForm from "@/components/survey-generator-form";
import SurveyBuilder from "@/components/survey-builder";
import SurveyPreview from "@/components/survey-preview";

export default function Home() {
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [surveyTitle, setSurveyTitle] = useState("Your Awesome Survey");
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

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="p-4 bg-primary/10 rounded-full mb-4">
        <Sparkles className="w-12 h-12 text-primary" />
      </div>
      <h2 className="text-2xl font-bold mb-2">Welcome to SurveySpark AI</h2>
      <p className="text-muted-foreground max-w-md">
        Use the panel on the left to generate a new survey. Simply describe your topic and let our AI do the rest.
      </p>
    </div>
  );

  return (
    <SidebarProvider>
        <Sidebar>
          <SidebarHeader>
            <Logo />
          </SidebarHeader>
          <SidebarContent className="p-4">
            <SurveyGeneratorForm
              onGenerateSurvey={handleSurveyGeneration}
              isLoading={isLoading}
            />
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
            {isLoading ? (
              <LoadingState />
            ) : questions.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid md:grid-cols-2 gap-0 h-full">
                <div className="bg-background/70 p-4 sm:p-6 md:p-8 overflow-y-auto h-screen">
                  <SurveyBuilder
                    title={surveyTitle}
                    questions={questions}
                    setQuestions={setQuestions}
                  />
                </div>
                <div className="bg-card/50 p-4 sm:p-6 md:p-8 overflow-y-auto h-screen border-l">
                  <SurveyPreview title={surveyTitle} questions={questions} />
                </div>
              </div>
            )}
        </SidebarInset>
    </SidebarProvider>
  );
}
