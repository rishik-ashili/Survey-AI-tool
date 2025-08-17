"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Download, Trash2, Save, PlusCircle, Loader2 } from "lucide-react";

import type { SurveyQuestion, SavedSurvey } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { exportToCsv } from "@/lib/csv";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useToast } from "@/hooks/use-toast";

type SurveyBuilderProps = {
  title: string;
  questions: SurveyQuestion[];
  setQuestions: React.Dispatch<React.SetStateAction<SurveyQuestion[]>>;
  onSaveSuccess: () => void;
  onAddMore: () => void;
  isLoadingMore: boolean;
};

export default function SurveyBuilder({
  title,
  questions,
  setQuestions,
  onSaveSuccess,
  onAddMore,
  isLoadingMore,
}: SurveyBuilderProps) {
  const [savedSurveys, setSavedSurveys] = useLocalStorage<SavedSurvey[]>("saved-surveys", []);
  const { toast } = useToast();

  const handleDelete = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const handleExport = () => {
    exportToCsv(questions, title);
  };

  const handleSaveSurvey = () => {
    if (questions.length === 0) {
      toast({
        variant: "destructive",
        title: "Cannot Save",
        description: "You cannot save an empty survey.",
      });
      return;
    }

    const newSurvey: SavedSurvey = {
      id: `survey-${Date.now()}`,
      title,
      questions,
      createdAt: new Date().toISOString(),
    };

    setSavedSurveys([...savedSurveys, newSurvey]);

    toast({
      title: "Survey Saved!",
      description: "Your survey has been saved successfully.",
    });
    onSaveSuccess();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-2xl font-bold tracking-tight">Survey Builder</h2>
          <p className="text-muted-foreground truncate" title={title}>
            Editing: {title}
          </p>
        </div>
        <div className="flex gap-2">
           <Button onClick={onAddMore} disabled={isLoadingMore} variant="outline">
            {isLoadingMore ? <Loader2 className="animate-spin" /> : <PlusCircle />}
            Add 5 More
          </Button>
          <Button onClick={handleSaveSurvey} disabled={questions.length === 0}>
            <Save className="mr-2 h-4 w-4" />
            Save Survey
          </Button>
          <Button onClick={handleExport} disabled={questions.length === 0} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export to CSV
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {questions.map((question, index) => (
            <motion.div
              key={question.id}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -300 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              layout
            >
              <Card className="group transition-all hover:border-primary/50 hover:shadow-md">
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="flex-shrink-0 text-primary font-bold text-lg mt-0.5">
                    {index + 1}
                  </div>
                  <p className="flex-1 text-card-foreground break-words">
                    {question.text}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleDelete(question.id)}
                    aria-label="Delete question"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
