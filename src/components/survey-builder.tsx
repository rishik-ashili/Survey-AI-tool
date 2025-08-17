
"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Trash2, Save, PlusCircle, Loader2, Type, Hash, Binary, List, GripVertical, MessageSquareQuote, ListChecks, GitBranch, Repeat, CornerDownRight } from "lucide-react";

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

// Recursive component to render each question and its sub-questions
const QuestionBuilderItem: React.FC<{
    question: SurveyQuestion;
    index: number;
    level?: number;
    onUpdate: (id: string, field: keyof SurveyQuestion, value: any, parentId?: string) => void;
    onDelete: (id: string, parentId?: string) => void;
    onTypeChange: (id: string, type: QuestionType, parentId?: string) => void;
    onOptionChange: (qId: string, optId: string, text: string, parentId?: string) => void;
    addOption: (qId: string, parentId?: string) => void;
    removeOption: (qId: string, optId: string, parentId?: string) => void;
}> = ({ question, index, level = 0, onUpdate, onDelete, onTypeChange, onOptionChange, addOption, removeOption }) => {
    const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

    const questionTypeIcons: Record<QuestionType, React.ReactNode> = {
        'text': <Type className="h-4 w-4" />,
        'number': <Hash className="h-4 w-4" />,
        'yes-no': <Binary className="h-4 w-4" />,
        'multiple-choice': <List className="h-4 w-4" />,
        'multiple-choice-multi': <ListChecks className="h-4 w-4" />,
    };

    const parentId = question.parent_question_id || undefined;

    return (
        <div className="space-y-3">
             <motion.div
                key={question.id}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -300 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                layout
                style={{ marginLeft: `${level * 2}rem` }}
              >
              <Card className="group transition-all hover:border-primary/50 hover:shadow-md">
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="flex-shrink-0 text-primary font-bold text-lg mt-0.5 flex items-center gap-2">
                    {level > 0 && <CornerDownRight className="h-5 w-5 text-muted-foreground" />}
                    {index + 1}
                  </div>
                  <div className="flex-1 space-y-3">
                    {question.is_iterative && (
                         <div className="flex items-center gap-2 p-2 rounded-md bg-blue-50 border border-blue-200 text-sm">
                            <Repeat className="h-4 w-4 text-blue-600"/>
                            <span className="text-blue-700">This question repeats for each item from: "{question.iterative_source_question_id}"</span>
                         </div>
                    )}
                    {question.parent_question_id && (
                         <div className="flex items-center gap-2 p-2 rounded-md bg-purple-50 border border-purple-200 text-sm">
                            <GitBranch className="h-4 w-4 text-purple-600"/>
                            <span className="text-purple-700">Shown if answer is "{question.trigger_condition_value}"</span>
                         </div>
                    )}
                    {editingQuestionId === question.id ? (
                        <Textarea
                          value={question.text}
                          onChange={(e) => onUpdate(question.id, 'text', e.target.value, parentId)}
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
                                    onChange={(e) => onOptionChange(question.id, option.id, e.target.value, parentId)}
                                    className="flex-1"
                                  />
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeOption(question.id, option.id, parentId)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                            ))}
                            <Button variant="outline" size="sm" onClick={() => addOption(question.id, parentId)}>
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
                                onChange={(e) => onUpdate(question.id, 'expected_answers', e.target.value, parentId)}
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
                                onChange={(e) => onUpdate(question.id, 'min_range', e.target.valueAsNumber || undefined, parentId)}
                                className="text-sm w-24"
                            />
                             <span className="text-muted-foreground">-</span>
                             <Input
                                id={`max-range-${question.id}`}
                                type="number"
                                placeholder="Max"
                                value={question.max_range ?? ''}
                                onChange={(e) => onUpdate(question.id, 'max_range', e.target.valueAsNumber || undefined, parentId)}
                                className="text-sm w-24"
                            />
                        </div>
                     )}
                  </div>
                  <div className="flex items-center gap-2">
                     <Select value={question.type} onValueChange={(v) => onTypeChange(question.id, v as QuestionType, parentId)}>
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
                        onClick={() => onDelete(question.id, parentId)}
                        aria-label="Delete question"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            
            {question.sub_questions && question.sub_questions.length > 0 && (
                <div className="space-y-3">
                    {question.sub_questions.map((sub, subIndex) => (
                         <QuestionBuilderItem
                            key={sub.id}
                            question={sub}
                            index={subIndex}
                            level={level + 1}
                            onUpdate={onUpdate}
                            onDelete={onDelete}
                            onTypeChange={onTypeChange}
                            onOptionChange={onOptionChange}
                            addOption={addOption}
                            removeOption={removeOption}
                         />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function SurveyBuilder({
  title,
  setTitle,
  questions,
  setQuestions,
  onSaveSuccess,
  onAddMore,
  isLoadingMore,
}: SurveyBuilderProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  
  // Recursive function to update a question (including sub-questions)
  const updateQuestionRecursive = (
      items: SurveyQuestion[], 
      id: string, 
      field: keyof SurveyQuestion, 
      value: any
  ): SurveyQuestion[] => {
      return items.map(q => {
          if (q.id === id) {
              return { ...q, [field]: value };
          }
          if (q.sub_questions) {
              return { ...q, sub_questions: updateQuestionRecursive(q.sub_questions, id, field, value) };
          }
          return q;
      });
  };
  
  const handleUpdateQuestion = (id: string, field: keyof SurveyQuestion, value: any) => {
      setQuestions(prev => updateQuestionRecursive(prev, id, field, value));
  };
  
  // Recursive delete
  const deleteQuestionRecursive = (items: SurveyQuestion[], id: string): SurveyQuestion[] => {
    return items.filter(q => {
        if (q.id === id) return false;
        if (q.sub_questions) {
            q.sub_questions = deleteQuestionRecursive(q.sub_questions, id);
        }
        return true;
    });
  }
  const handleDelete = (id: string) => {
    setQuestions(prev => deleteQuestionRecursive(prev, id));
  };
  
  const updateQuestionPropertyRecursive = (
    items: SurveyQuestion[], id: string, 
    updateFn: (q: SurveyQuestion) => SurveyQuestion
  ): SurveyQuestion[] => {
      return items.map(q => {
          if (q.id === id) return updateFn(q);
          if (q.sub_questions) {
             return { ...q, sub_questions: updateQuestionPropertyRecursive(q.sub_questions, id, updateFn) };
          }
          return q;
      });
  }

  const handleQuestionTypeChange = (id: string, type: QuestionType) => {
    const updateFn = (q: SurveyQuestion): SurveyQuestion => {
      const isMultipleChoice = type.startsWith('multiple-choice');
      return {
          ...q,
          type: type,
          options: isMultipleChoice ? (q.options || [{id: `opt-${Date.now()}`, text: 'Option 1'}]) : undefined,
          min_range: type === 'number' ? q.min_range : undefined,
          max_range: type === 'number' ? q.max_range : undefined,
      }
    };
    setQuestions(prev => updateQuestionPropertyRecursive(prev, id, updateFn));
  }
  
  const handleOptionChange = (qId: string, optId: string, text: string) => {
    const updateFn = (q: SurveyQuestion): SurveyQuestion => ({
      ...q,
      options: q.options?.map(opt => opt.id === optId ? {...opt, text} : opt)
    });
    setQuestions(prev => updateQuestionPropertyRecursive(prev, qId, updateFn));
  }
  
  const addOption = (qId: string) => {
    const updateFn = (q: SurveyQuestion): SurveyQuestion => ({
      ...q,
      options: [...(q.options || []), {id: `opt-${Date.now()}`, text: `Option ${ (q.options?.length || 0) + 1}`}]
    });
     setQuestions(prev => updateQuestionPropertyRecursive(prev, qId, updateFn));
  }

  const removeOption = (qId: string, optId: string) => {
    const updateFn = (q: SurveyQuestion): SurveyQuestion => ({
       ...q,
       options: q.options?.filter(opt => opt.id !== optId)
    });
    setQuestions(prev => updateQuestionPropertyRecursive(prev, qId, updateFn));
  }

  const handleExport = () => {
    exportToCsv(questions, title);
  };

  const handleSaveSurvey = async () => {
    if (questions.length === 0) {
      toast({ variant: "destructive", title: "Cannot Save", description: "You cannot save an empty survey." });
      return;
    }

    setIsSaving(true);
    
    // Map temporary iterative source IDs to the text of the question, as the AI needs text.
    const questionsToSave = JSON.parse(JSON.stringify(questions)); // Deep copy to avoid mutating state
    const findQuestionTextById = (id: string, searchQuestions: SurveyQuestion[]): string | null => {
        for (const q of searchQuestions) {
            if (q.id === id) return q.text;
            if (q.sub_questions) {
                const foundText = findQuestionTextById(id, q.sub_questions);
                if (foundText) return foundText;
            }
        }
        return null;
    }

    const mapIterativeSource = (qs: SurveyQuestion[]) => {
        return qs.map(q => {
            if (q.is_iterative && q.iterative_source_question_id) {
                 q.iterative_source_question_id = findQuestionTextById(q.iterative_source_question_id, questions) || undefined;
            }
            if (q.sub_questions) {
                q.sub_questions = mapIterativeSource(q.sub_questions);
            }
            delete (q as any).id; // Remove temp id
            return q;
        });
    }

    const finalQuestions = mapIterativeSource(questionsToSave);

    const { data, error } = await saveSurvey(title, finalQuestions);
    setIsSaving(false);

    if (error || !data) {
       toast({ variant: "destructive", title: "Save Failed", description: error || "An unknown error occurred." });
    } else {
      toast({ title: "Survey Saved!", description: "Your survey has been saved successfully." });
      onSaveSuccess();
    }
  };
  

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
             <QuestionBuilderItem
                key={question.id}
                question={question}
                index={index}
                onUpdate={handleUpdateQuestion as any}
                onDelete={handleDelete}
                onTypeChange={handleQuestionTypeChange}
                onOptionChange={handleOptionChange as any}
                addOption={addOption as any}
                removeOption={removeOption as any}
             />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
