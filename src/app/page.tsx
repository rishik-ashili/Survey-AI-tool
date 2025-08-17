
"use client";

import { useState } from "react";
import { FileText, Loader2, Sparkles, PencilRuler, Eye, Save, ListChecks } from "lucide-react";

import type { SurveyQuestion, SavedSurvey } from "@/types";
import { handleGenerateSurvey, type GenerateSurveyInput, type GenerateSurveyOutput } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import Logo from "@/components/logo";
import SurveyGeneratorForm from "@/components/survey-generator-form";
import SurveyBuilder from "@/components/survey-builder";
import SurveyPreview from "@/components/survey-preview";
import SavedSurveysList from "@/components/saved-surveys-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import AddMoreQuestionsDialog from "@/components/add-more-questions-dialog";

export default function Home() {
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [surveyTitle, setSurveyTitle] = useState("Your Awesome Survey");
  const [activeTab, setActiveTab] = useState("generator");
  const [lastGenerationData, setLastGenerationData] = useState<Omit<GenerateSurveyInput, 'existingQuestions' | 'numberOfQuestions'> | null>(null);
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
    setLastGenerationData(data);

    try {
      const result = await handleGenerateSurvey({...data, numberOfQuestions: 5, existingQuestions: [] });
      if (result && result.surveyQuestions.length > 0) {
        setQuestions(
          result.surveyQuestions.map((q, i) => ({
            id: `q-${Date.now()}-${i}`, // Temporary ID for client-side
            text: q.text,
            type: q.type,
            options: q.options?.map((opt, j) => ({ id: `opt-${Date.now()}-${i}-${j}`, text: opt.text }))
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
  
  const handleAddMoreQuestions = async (updatedPrompt?: string) => {
    if (!lastGenerationData) return;

    setIsLoadingMore(true);
    try {
       const result = await handleGenerateSurvey({
        ...lastGenerationData,
        prompt: updatedPrompt || lastGenerationData.prompt,
        numberOfQuestions: 5,
        existingQuestions: questions.map(q => q.text),
      });

      if (result && result.surveyQuestions.length > 0) {
        const newQuestions = result.surveyQuestions.map((q, i) => ({
            id: `q-${Date.now()}-more-${i}`, // Temporary ID
            text: q.text,
            type: q.type,
            options: q.options?.map((opt, j) => ({ id: `opt-${Date.now()}-more-${i}-${j}`, text: opt.text }))
        }));

        setQuestions(prev => [...prev, ...newQuestions]);
        toast({
          title: "Added More Questions!",
          description: "5 new questions have been added to your survey.",
        });
      } else {
         toast({
          variant: "destructive",
          title: "Generation Failed",
          description: "Could not generate more questions. Please try again.",
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
        setIsLoadingMore(false);
    }
  }

  const resetGenerator = () => {
    setQuestions([]);
    setSurveyTitle("Your Awesome Survey");
    setLastGenerationData(null);
  }


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
    <>
    <AddMoreQuestionsDialog
        isOpen={!!lastGenerationData && activeTab === 'builder'}
        originalPrompt={lastGenerationData?.prompt ?? ''}
        onAddMore={handleAddMoreQuestions}
        isLoading={isLoadingMore}
      />
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
            <TabsTrigger value="saved">
              <ListChecks className="mr-2" /> Saved
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
                  onSaveSuccess={() => {
                    setActiveTab("saved");
                    resetGenerator();
                  }}
                  onAddMore={() => {
                    const dialogTrigger = document.getElementById('add-more-dialog-trigger');
                    dialogTrigger?.click();
                  }}
                  isLoadingMore={isLoadingMore}
                />
              </div>
             )}
          </TabsContent>
          <TabsContent value="preview" className="flex-1 overflow-y-auto p-4 md:p-8 bg-muted/40">
            <div className="max-w-2xl mx-auto">
              <SurveyPreview title={surveyTitle} questions={questions} />
            </div>
          </TabsContent>
          <TabsContent value="saved" className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
              <SavedSurveysList />
            </div>
          </TabsContent>

          <div className="block md:hidden p-2 border-t bg-background">
             <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="generator">
                  <Sparkles />
                </TabsTrigger>
                <TabsTrigger value="builder" disabled={questions.length === 0}>
                  <PencilRuler />
                </TabsTrigger>
                <TabsTrigger value="preview" disabled={questions.length === 0}>
                  <Eye />
                </TabsTrigger>
                 <TabsTrigger value="saved">
                  <ListChecks />
                </TabsTrigger>
              </TabsList>
          </div>
        </Tabs>
      </main>
    </div>
    </>
  );
}
