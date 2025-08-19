
"use client";

import { useState, useEffect } from "react";
import { FileText, Loader2, Sparkles, PencilRuler, Eye, Save, ListChecks, Network, GitBranch, Repeat, MessageCircleQuestion } from "lucide-react";

import type { SurveyQuestion, SavedSurvey } from "@/types";
import { handleGenerateSurvey, type GenerateSurveyInput } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import Logo from "@/components/logo";
import SurveyGeneratorForm from "@/components/survey-generator-form";
import SurveyBuilder from "@/components/survey-builder";
import SurveyPreview from "@/components/survey-preview";
import SavedSurveysList from "@/components/saved-surveys-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import AddMoreQuestionsDialog from "@/components/add-more-questions-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import ProtectedLayout from "@/components/protected-layout";
import { useAuth } from "@/contexts/auth-context";

// Helper to recursively assign temporary unique IDs
const assignTemporaryIds = (questions: any[]): SurveyQuestion[] => {
  return questions.map((q, i) => {
    const questionId = `q-${Date.now()}-${i}`;
    const newQuestion: SurveyQuestion = {
      ...q,
      id: questionId,
      options: q.options?.map((opt: any, j: number) => ({ id: `opt-${questionId}-${j}`, text: opt.text })),
    };
    if (q.sub_questions) {
      newQuestion.sub_questions = q.sub_questions.map((subQ: any, k: number) => {
        const subQuestionId = `q-${Date.now()}-sub-${i}-${k}`;
        return {
          ...subQ,
          id: subQuestionId,
          parent_question_id: questionId,
          options: subQ.options?.map((opt: any, l: number) => ({ id: `opt-${subQuestionId}-${l}`, text: opt.text })),
        }
      })
    }
    return newQuestion;
  });
};


export default function Home() {
  const { isAdmin } = useAuth();
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [surveyTitle, setSurveyTitle] = useState("Your Awesome Survey");
  const [activeTab, setActiveTab] = useState("saved"); // Always start with "saved" tab
  const [lastGenerationData, setLastGenerationData] = useState<Omit<GenerateSurveyInput, 'existingQuestions' | 'numberOfQuestions'> | null>(null);

  // New state for advanced survey options
  const [isDetailed, setIsDetailed] = useState(false);
  const [isIterative, setIsIterative] = useState(false);
  const [hasPersonalizedQuestions, setHasPersonalizedQuestions] = useState(false);

  const { toast } = useToast();

  // Set the correct default tab based on admin status once auth is loaded
  useEffect(() => {
    if (isAdmin && activeTab === "saved") {
      setActiveTab("generator");
    }
  }, [isAdmin, activeTab]);

  const handleSurveyGeneration = async (data: {
    prompt: string;
    userInstructions: string;
    exampleInputs: string;
    questionBankContent: string;
  }) => {
    setIsLoading(true);
    setQuestions([]);
    setSurveyTitle(data.prompt || "Generated Survey");

    const generationInput: GenerateSurveyInput = {
      ...data,
      numberOfQuestions: 5,
      existingQuestions: [],
      generateDetailedSurvey: isDetailed,
      generateIterativeSurvey: isIterative,
      generatePersonalizedQuestions: hasPersonalizedQuestions,
    };

    setLastGenerationData(generationInput);


    try {
      const result = await handleGenerateSurvey(generationInput);

      if (result && result.surveyQuestions.length > 0) {
        const questionsWithIds = assignTemporaryIds(result.surveyQuestions);
        setQuestions(questionsWithIds);

        toast({
          title: "Survey Generated!",
          description: "Your survey is ready for review in the Builder tab.",
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
        generateDetailedSurvey: isDetailed,
        generateIterativeSurvey: isIterative,
        generatePersonalizedQuestions: hasPersonalizedQuestions,
      });

      if (result && result.surveyQuestions.length > 0) {
        const newQuestions = assignTemporaryIds(result.surveyQuestions);
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
    <ProtectedLayout>
      <AddMoreQuestionsDialog
        isOpen={!!lastGenerationData && activeTab === 'builder'}
        originalPrompt={lastGenerationData?.prompt ?? ''}
        onAddMore={handleAddMoreQuestions}
        isLoading={isLoadingMore}
      />
      <div className="flex flex-col h-full bg-muted/20">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="hidden md:block mb-4">
          <TabsList>
            {isAdmin && (
              <>
                <TabsTrigger value="generator">
                  <Sparkles className="mr-2" /> Generator
                </TabsTrigger>
                <TabsTrigger value="builder" disabled={questions.length === 0}>
                  <PencilRuler className="mr-2" /> Builder
                </TabsTrigger>
                <TabsTrigger value="preview" disabled={questions.length === 0}>
                  <Eye className="mr-2" /> Preview
                </TabsTrigger>
              </>
            )}
            <TabsTrigger value="saved">
              <ListChecks className="mr-2" /> Saved
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <main className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            {isAdmin && (
              <>
                <TabsContent value="generator" className="flex-1 overflow-y-auto p-4 md:p-8">
                  <div className="max-w-2xl mx-auto">
                    <SurveyGeneratorForm
                      onGenerateSurvey={handleSurveyGeneration}
                      isLoading={isLoading}
                    >
                      <div className="space-y-4 rounded-lg border p-4">
                        <h3 className="text-lg font-medium">Advanced Options</h3>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="detailed-survey" className="flex flex-col gap-1">
                            <span className="flex items-center gap-2"><GitBranch /> Detailed Survey</span>
                            <span className="font-normal text-muted-foreground text-sm">Generate conditional sub-questions.</span>
                          </Label>
                          <Switch id="detailed-survey" checked={isDetailed} onCheckedChange={setIsDetailed} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="iterative-survey" className="flex flex-col gap-1">
                            <span className="flex items-center gap-2"><Repeat /> Iterative Survey</span>
                            <span className="font-normal text-muted-foreground text-sm">Generate looping questions for repeated data entry.</span>
                          </Label>
                          <Switch id="iterative-survey" checked={isIterative} onCheckedChange={setIsIterative} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="personalized-questions" className="flex flex-col gap-1">
                            <span className="flex items-center gap-2"><MessageCircleQuestion /> Personalized Questions</span>
                            <span className="font-normal text-muted-foreground text-sm">Add optional, AI-generated questions at the end.</span>
                          </Label>
                          <Switch id="personalized-questions" checked={hasPersonalizedQuestions} onCheckedChange={setHasPersonalizedQuestions} />
                        </div>
                      </div>
                    </SurveyGeneratorForm>
                  </div>
                </TabsContent>
                <TabsContent value="builder" className="flex-1 overflow-y-auto p-4 md:p-8">
                  {isLoading ? <LoadingState /> : (
                    <div className="max-w-4xl mx-auto">
                      <SurveyBuilder
                        title={surveyTitle}
                        setTitle={setSurveyTitle}
                        questions={questions}
                        setQuestions={setQuestions}
                        hasPersonalizedQuestions={hasPersonalizedQuestions}
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
              </>
            )}
            <TabsContent value="saved" className="flex-1 overflow-y-auto p-4 md:p-8">
              <div className="max-w-4xl mx-auto">
                <SavedSurveysList />
              </div>
            </TabsContent>

            <div className="block md:hidden p-2 border-t bg-background">
              <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-4' : 'grid-cols-1'}`}>
                {isAdmin && (
                  <>
                    <TabsTrigger value="generator">
                      <Sparkles />
                    </TabsTrigger>
                    <TabsTrigger value="builder" disabled={questions.length === 0}>
                      <PencilRuler />
                    </TabsTrigger>
                    <TabsTrigger value="preview" disabled={questions.length === 0}>
                      <Eye />
                    </TabsTrigger>
                  </>
                )}
                <TabsTrigger value="saved">
                  <ListChecks />
                </TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </main>
      </div>
    </ProtectedLayout>
  );
}
