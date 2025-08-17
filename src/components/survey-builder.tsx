
"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Trash2, Save, PlusCircle, Loader2, Type, Hash, Binary, List, GripVertical, MessageSquareQuote, CheckSquare, ListChecks } from "lucide-react";

import type { SurveyQuestion, QuestionType, QuestionOption } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { exportToCsv } from "@/lib/csv";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { saveSurvey } from "@/app/actions";
import { Label } from "./ui/label";


type SurveyBuilderProps = {
  title: string;
  setTitle: (title: string) => void;
  questions: SurveyQuestion[];
  setQuestions: React.Dispatch<React.SetStateAction<SurveyQuestion[]>>;
  onSaveSuccess: () => void;
  onAddMore: () => void;
  isLoadingMore: boolean;
};

export default function SurveyBuilder({
  title,
  setTitle,
  questions,
  setQuestions,
  onSaveSuccess,
  onAddMore,
  isLoadingMore,
}: SurveyBuilderProps) {
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleUpdateQuestion = (id: string, field: keyof SurveyQuestion, value: any) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));
  }

  const handleDelete = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };
  
  const handleQuestionTypeChange = (id: string, type: QuestionType) => {
    setQuestions(prev => prev.map(q => {
        if (q.id !== id) return q;
        const isMultipleChoice = type.startsWith('multiple-choice');
        return {
            ...q,
            type: type,
            options: isMultipleChoice ? (q.options || [{id: `opt-${Date.now()}`, text: 'Option 1'}]) : undefined,
            min_range: type === 'number' ? q.min_range : undefined,
            max_range: type === 'number' ? q.max_range : undefined,
        }
    }));
  }
  
  const handleOptionChange = (qId: string, optId: string, text: string) => {
    setQuestions(prev => prev.map(q => q.id === qId ? {
      ...q,
      options: q.options?.map(opt => opt.id === optId ? {...opt, text} : opt)
    } : q));
  }
  
  const addOption = (qId: string) => {
     setQuestions(prev => prev.map(q => q.id === qId ? {
      ...q,
      options: [...(q.options || []), {id: `opt-${Date.now()}`, text: `Option ${ (q.options?.length || 0) + 1}`}]
    } : q));
  }

  const removeOption = (qId: string, optId: string) => {
    setQuestions(prev => prev.map(q => q.id === qId ? {
      ...q,
      options: q.options?.filter(opt => opt.id !== optId)
    } : q));
  }


  const handleExport = () => {
    exportToCsv(questions, title);
  };

  const handleSaveSurvey = async () => {
    if (questions.length === 0) {
      toast({
        variant: "destructive",
        title: "Cannot Save",
        description: "You cannot save an empty survey.",
      });
      return;
    }

    setIsSaving(true);
    const questionsToSave = questions.map(({id, ...q}) => q);
    const { data, error } = await saveSurvey(title, questionsToSave);
    setIsSaving(false);

    if (error || !data) {
       toast({
        variant: "destructive",
        title: "Save Failed",
        description: error || "An unknown error occurred.",
      });
    } else {
      toast({
        title: "Survey Saved!",
        description: "Your survey has been saved successfully.",
      });
      onSaveSuccess();
    }
  };
  
  const questionTypeIcons: Record<QuestionType, React.ReactNode> = {
    'text': <Type className="h-4 w-4" />,
    'number': <Hash className="h-4 w-4" />,
    'yes-no': <Binary className="h-4 w-4" />,
    'multiple-choice': <List className="h-4 w-4" />,
    'multiple-choice-multi': <ListChecks className="h-4 w-4" />,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-2xl font-bold tracking-tight">Survey Builder</h2>
           <Input 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-muted-foreground text-lg border-none -ml-3 shadow-none focus-visible:ring-1 focus-visible:ring-ring"
            />
        </div>
        <div className="flex gap-2">
           <Button onClick={onAddMore} disabled={isLoadingMore} variant="outline">
            {isLoadingMore ? <Loader2 className="animate-spin" /> : <PlusCircle />}
            Add 5 More
          </Button>
          <Button onClick={handleSaveSurvey} disabled={questions.length === 0 || isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isSaving ? 'Saving...' : 'Save Survey'}
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
                  <div className="flex-1 space-y-3">
                    {editingQuestionId === question.id ? (
                        <Textarea
                          value={question.text}
                          onChange={(e) => handleUpdateQuestion(question.id, 'text', e.target.value)}
                          onBlur={() => setEditingQuestionId(null)}
                          autoFocus
                          className="flex-1 bg-transparent border-primary/50"
                        />
                    ) : (
                      <p className="flex-1 text-card-foreground break-words cursor-pointer" onClick={() => setEditingQuestionId(question.id)}>
                        {question.text}
                      </p>
                    )}
                    {(question.type === 'multiple-choice' || question.type === 'multiple-choice-multi') && (
                        <div className="space-y-2 pl-4">
                            {question.options?.map(option => (
                                <div key={option.id} className="flex items-center gap-2">
                                  <GripVertical className="h-4 w-4 text-muted-foreground"/>
                                  <Input 
                                    value={option.text}
                                    onChange={(e) => handleOptionChange(question.id, option.id, e.target.value)}
                                    className="flex-1"
                                  />
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeOption(question.id, option.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                            ))}
                            <Button variant="outline" size="sm" onClick={() => addOption(question.id)}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Add Option
                            </Button>
                        </div>
                    )}
                     {question.type === 'text' && (
                        <div className="space-y-2 pl-4">
                            <Label htmlFor={`expected-answers-${question.id}`} className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MessageSquareQuote className="h-4 w-4"/>
                                Expected Answers (Optional, comma-separated)
                            </Label>
                            <Textarea
                                id={`expected-answers-${question.id}`}
                                placeholder="e.g., Delhi, Mumbai, Kolkata"
                                value={question.expected_answers || ''}
                                onChange={(e) => handleUpdateQuestion(question.id, 'expected_answers', e.target.value)}
                                className="text-sm"
                            />
                        </div>
                     )}
                     {question.type === 'number' && (
                        <div className="space-y-2 pl-4 flex items-center gap-4">
                            <Label htmlFor={`min-range-${question.id}`} className="flex items-center gap-2 text-sm text-muted-foreground">
                                Range
                            </Label>
                            <Input
                                id={`min-range-${question.id}`}
                                type="number"
                                placeholder="Min"
                                value={question.min_range ?? ''}
                                onChange={(e) => handleUpdateQuestion(question.id, 'min_range', e.target.valueAsNumber || undefined)}
                                className="text-sm w-24"
                            />
                             <span className="text-muted-foreground">-</span>
                             <Input
                                id={`max-range-${question.id}`}
                                type="number"
                                placeholder="Max"
                                value={question.max_range ?? ''}
                                onChange={(e) => handleUpdateQuestion(question.id, 'max_range', e.target.valueAsNumber || undefined)}
                                className="text-sm w-24"
                            />
                        </div>
                     )}
                  </div>
                  <div className="flex items-center gap-2">
                     <Select value={question.type} onValueChange={(v) => handleQuestionTypeChange(question.id, v as QuestionType)}>
                        <SelectTrigger className="w-[220px]">
                           <div className="flex items-center gap-2">
                            {questionTypeIcons[question.type]}
                            <SelectValue placeholder="Type" />
                           </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="text"><div className="flex items-center gap-2"><Type /> Text</div></SelectItem>
                            <SelectItem value="number"><div className="flex items-center gap-2"><Hash /> Number</div></SelectItem>
                            <SelectItem value="yes-no"><div className="flex items-center gap-2"><Binary /> Yes/No</div></SelectItem>
                            <SelectItem value="multiple-choice"><div className="flex items-center gap-2"><List /> Multiple Choice (Single)</div></SelectItem>
                            <SelectItem value="multiple-choice-multi"><div className="flex items-center gap-2"><ListChecks /> Multiple Choice (Multi)</div></SelectItem>
                        </SelectContent>
                    </Select>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleDelete(question.id)}
                        aria-label="Delete question"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

    