
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { SavedSurvey, SurveyQuestion, SubmissionMetadata } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send, User, VenetianMask, Loader2, ChevronsRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { submitSurvey, handleValidateAnswer, handleShouldAskQuestion } from '@/app/actions';

type AttemptSurveyProps = {
  survey: SavedSurvey;
  onBack: () => void;
};

type ValidationErrors = Record<string, { message: string, suggestion?: string }>;

type CurrentQuestionInfo = {
    question: SurveyQuestion;
    path: string; 
    iteration?: number; 
};

type HistoryItem = {
    questionInfo: CurrentQuestionInfo;
    answer: any;
};


export default function AttemptSurvey({ survey, onBack }: AttemptSurveyProps) {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userName, setUserName] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [metadata, setMetadata] = useState<SubmissionMetadata>({});
  const [errors, setErrors] = useState<ValidationErrors>({});
  const { toast } = useToast();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [currentQuestionInfo, setCurrentQuestionInfo] = useState<CurrentQuestionInfo | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const questionMap = useMemo(() => {
    const map = new Map<string, SurveyQuestion>();
    const traverse = (questions: SurveyQuestion[], prefix: string) => {
        questions.forEach((q, index) => {
            const path = prefix ? `${prefix}.${index}` : `${index}`;
            map.set(path, q);
            if (q.sub_questions) {
                traverse(q.sub_questions, path);
            }
        });
    }
    traverse(survey.questions, '');
    return map;
  }, [survey.questions]);


  useEffect(() => {
    // This effect runs once to kick off the survey
    const startSurvey = async () => {
      if (survey.questions.length > 0) {
        const firstQuestionInfo = { question: survey.questions[0], path: '0' };
        // We need to check if we should even ask the first question
        const { shouldAsk } = await handleShouldAskQuestion({
          question: firstQuestionInfo.question.text,
          previousAnswers: []
        });
        if (shouldAsk) {
          setCurrentQuestionInfo(firstQuestionInfo);
        } else {
          // This case is unlikely for the first question but handled for completeness
          const skippedHistory: HistoryItem = { questionInfo: firstQuestionInfo, answer: '[SKIPPED_BY_AI]' };
          const nextInfo = await getNextQuestion([skippedHistory]);
          setCurrentQuestionInfo(nextInfo);
        }
      }
    };
    startSurvey();
  }, [survey.questions, getNextQuestion]);

  const getQuestionFromPath = useCallback((path: string): SurveyQuestion | undefined => {
    return questionMap.get(path);
  }, [questionMap]);

  const findNextQuestionPath = useCallback((path: string): string | null => {
        const pathParts = path.split('.').map(Number);

        // Try to find next sibling
        const nextSiblingPath = [...pathParts.slice(0, -1), pathParts.at(-1)! + 1].join('.');
        if (questionMap.has(nextSiblingPath)) {
            return nextSiblingPath;
        }

        // If no sibling, go up to parent and find its next sibling
        if (pathParts.length > 1) {
            return findNextQuestionPath(pathParts.slice(0, -1).join('.'));
        }

        return null; // Reached end of survey
  }, [questionMap]);


  const getNextQuestion = useCallback(async (historyStack: HistoryItem[]): Promise<CurrentQuestionInfo | null> => {
      if (historyStack.length === 0 && survey.questions.length > 0) {
        return { question: survey.questions[0], path: '0' };
      }
      if (historyStack.length === 0) {
        return null;
      }

      const lastHistoryItem = historyStack.at(-1)!;
      const { questionInfo: lastQuestionInfo, answer: lastAnswer } = lastHistoryItem;
      const lastQuestion = lastQuestionInfo.question;

      // 1. Check for triggered sub-questions
      if (lastQuestion.sub_questions && lastQuestion.sub_questions.length > 0) {
          const triggeredSubQuestion = lastQuestion.sub_questions.find(
              sq => sq.trigger_condition_value === String(lastAnswer)
          );
          if (triggeredSubQuestion) {
              const subQuestionIndex = lastQuestion.sub_questions.indexOf(triggeredSubQuestion);
              const nextPath = `${lastQuestionInfo.path}.${subQuestionIndex}`;
              const nextInfo = { question: triggeredSubQuestion, path: nextPath };
               // Check if we should ask this sub-question
              const { shouldAsk } = await handleShouldAskQuestion({ question: nextInfo.question.text, previousAnswers: historyStack.map(h => ({ question: h.questionInfo.question.text, answer: String(h.answer) })) });
              if (shouldAsk) return nextInfo;
              // If not, we need to find what's next *after* this skipped sub-question
              return getNextQuestion([...historyStack, { questionInfo: nextInfo, answer: '[SKIPPED_BY_AI]' }]);
          }
      }

       // 2. Handle iterative logic
      // 2a. Check if we should START a new iteration
      const questionsArray = Array.from(questionMap.values());
      const nextIterativeQuestion = questionsArray.find(q => q.is_iterative && q.iterative_source_question_id === lastQuestion.id);
      if (nextIterativeQuestion && !isNaN(Number(lastAnswer)) && Number(lastAnswer) > 0) {
          const iterativeQuestionPath = [...questionMap.entries()].find(([path, q]) => q.id === nextIterativeQuestion.id)?.[0];
          if(iterativeQuestionPath) {
            const nextInfo = { question: nextIterativeQuestion, path: iterativeQuestionPath, iteration: 1 };
            return nextInfo; // Always ask the first iteration
          }
      }

      // 2b. Check if we are IN an iteration
      if (lastQuestionInfo.iteration) {
          const sourceQuestionId = lastQuestion.iterative_source_question_id;
          const sourceAnswerItem = historyStack.find(h => h.questionInfo.question.id === sourceQuestionId);
          const totalIterations = Number(sourceAnswerItem?.answer || 0);

          if (lastQuestionInfo.iteration < totalIterations) {
              return { ...lastQuestionInfo, iteration: lastQuestionInfo.iteration + 1 };
          }
          // Iteration finished, so we fall through to find the next question after the iterative block
      }
      
      // 3. Find next question in sequence (sibling or parent's sibling)
      const nextPath = findNextQuestionPath(lastQuestionInfo.path);
      if (nextPath) {
        const nextQuestion = getQuestionFromPath(nextPath)!;
        const nextInfo = { question: nextQuestion, path: nextPath };

        // Check if we should ask it
        const { shouldAsk } = await handleShouldAskQuestion({ question: nextInfo.question.text, previousAnswers: historyStack.map(h => ({ question: h.questionInfo.question.text, answer: String(h.answer) })) });

        if (shouldAsk) {
          return nextInfo;
        } else {
          // If AI says skip, add a placeholder to history and recurse
          const skippedHistoryItem: HistoryItem = { questionInfo: nextInfo, answer: '[SKIPPED_BY_AI]' };
          return getNextQuestion([...historyStack, skippedHistoryItem]);
        }
      }

      return null;
  }, [findNextQuestionPath, getQuestionFromPath, questionMap, survey.questions]);


  const handleNext = async () => {
    if (!currentQuestionInfo) return;
    setIsNavigating(true);

    const { question, iteration } = currentQuestionInfo;
    const answer = iteration 
      ? (answers[question.id]?.values || [])[iteration -1]
      : answers[question.id];

    // Validation
    const newErrors: ValidationErrors = {};
    if (answer === undefined || answer === null || answer === '' || (Array.isArray(answer) && answer.length === 0)) {
        newErrors[question.id] = { message: 'This question is required.' };
    } else if (question.type === 'number') {
        const numAnswer = Number(answer);
        if (question.min_range !== undefined && question.min_range !== null && numAnswer < question.min_range) {
             newErrors[question.id] = { message: `Value must be at least ${question.min_range}.` };
        }
        if (question.max_range !== undefined && question.max_range !== null && numAnswer > question.max_range) {
             newErrors[question.id] = { message: `Value must be at most ${question.max_range}.` };
        }
    }
    
    if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        setIsNavigating(false);
        return;
    }
    
     const validationInput = {
        question: question.text,
        answer: String(answer),
        expected_answers: question.expected_answers
    };

    if (question.type === 'text') {
        const validationResult = await handleValidateAnswer(validationInput);
        if (!validationResult.isValid) {
            setErrors({[question.id]: { message: validationResult.suggestion, suggestion: validationResult.suggestion }});
            setIsNavigating(false);
            return;
        }
    }

    const newHistoryItem: HistoryItem = { questionInfo: currentQuestionInfo, answer: answer };
    const updatedHistory = [...history, newHistoryItem];
    setHistory(updatedHistory);
    
    const nextInfo = await getNextQuestion(updatedHistory);
    
    setCurrentQuestionInfo(nextInfo);
    if (!nextInfo) {
        toast({ title: "All questions answered!", description: "You can now submit your survey."})
    }
    setIsNavigating(false);
  }
  
  const handleAnswerChange = (questionId: string, value: string | number | string[], iteration?: number) => {
      setErrors({}); // Clear errors on change
      if (iteration) {
          setAnswers(prev => {
              const existing = prev[questionId] || { isIterative: true, values: [] };
              const newValues = [...existing.values];
              newValues[iteration - 1] = value;
              return { ...prev, [questionId]: { ...existing, values: newValues }};
          })
      } else {
        setAnswers((prev) => ({ ...prev, [questionId]: value }));
      }
  };

  const handleMultipleChoiceChange = (questionId: string, optionText: string, isChecked: boolean) => {
    const currentAnswers = (answers[questionId] as string[] | undefined) || [];
    const newAnswers = isChecked
      ? [...currentAnswers, optionText]
      : currentAnswers.filter((ans) => ans !== optionText);
    handleAnswerChange(questionId, newAnswers);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentQuestionInfo !== null) {
        toast({ variant: "destructive", title: "Survey not complete", description: "Please answer all questions before submitting."});
        return;
    }
    if (!isAnonymous && !userName) {
        toast({ variant: "destructive", title: "Name Required", description: "Please enter your name or check the anonymous box." });
        return;
    }

    setIsSubmitting(true);
    const { error } = await submitSurvey(survey.id, answers, isAnonymous ? undefined : userName, metadata);
    setIsSubmitting(false);

    if (error) {
         toast({ variant: "destructive", title: "Submission Failed", description: "Something went wrong. Please try again." });
    } else {
        setSubmitted(true);
        toast({ title: "Survey Submitted!", description: "Thank you for your feedback." });
    }
  };

  if (submitted) {
    return (
         <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
                <h2 className="text-2xl font-bold tracking-tight mb-4">Thank You!</h2>
                <p className="text-muted-foreground mb-6">Your response has been recorded.</p>
                <Button onClick={onBack}>
                    <ArrowLeft className="mr-2 h-4 w-4"/>
                    Back to Saved Surveys
                </Button>
            </motion.div>
        </div>
    )
  }

  const renderInput = (qInfo: CurrentQuestionInfo) => {
      const question = qInfo.question;
      const value = qInfo.iteration 
        ? (answers[question.id]?.values || [])[qInfo.iteration - 1]
        : answers[question.id];
      const error = errors[question.id];

      return (
          <>
            {(() => {
                switch (question.type) {
                    case 'number':
                        return <Input id={`answer-${question.id}`} type="number" value={value || ''} onChange={(e) => handleAnswerChange(question.id, e.target.value, qInfo.iteration)} required className={error ? 'border-destructive' : ''} />
                    case 'yes-no':
                        return (
                            <RadioGroup onValueChange={(v) => handleAnswerChange(question.id, v, qInfo.iteration)} value={value as string || ''} className={error ? 'rounded-md border border-destructive p-2' : ''}>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="Yes" id={`yes-${question.id}`} /><Label htmlFor={`yes-${question.id}`}>Yes</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="No" id={`no-${question.id}`} /><Label htmlFor={`no-${question.id}`}>No</Label></div>
                            </RadioGroup>
                        )
                    case 'multiple-choice':
                         return (
                             <RadioGroup onValueChange={(v) => handleAnswerChange(question.id, v, qInfo.iteration)} value={value as string || ''} className={`space-y-2 ${error ? 'rounded-md border border-destructive p-2' : ''}`}>
                                {question.options?.map(option => (
                                    <div key={option.id} className="flex items-center space-x-2"><RadioGroupItem value={option.text} id={`${question.id}-${option.id}`} /><Label htmlFor={`${question.id}-${option.id}`}>{option.text}</Label></div>
                                ))}
                            </RadioGroup>
                        )
                    case 'multiple-choice-multi':
                         return (
                            <div className={`space-y-2 ${error ? 'rounded-md border border-destructive p-2' : ''}`}>
                                {question.options?.map(option => (
                                    <div key={option.id} className="flex items-center space-x-2">
                                        <Checkbox id={`${question.id}-${option.id}`} onCheckedChange={(checked) => handleMultipleChoiceChange(question.id, option.text, !!checked)} checked={((answers[question.id] as string[]) || []).includes(option.text)} />
                                        <Label htmlFor={`${question.id}-${option.id}`}>{option.text}</Label>
                                    </div>
                                ))}
                            </div>
                        )
                    case 'text':
                    default:
                        return <Textarea placeholder="Your answer..." value={value as string || ''} onChange={(e) => handleAnswerChange(question.id, e.target.value, qInfo.iteration)} required className={`min-h-[100px] ${error ? 'border-destructive' : ''}`} />
                }
            })()}
            {error && <p className="text-sm text-destructive mt-2">{error.message}</p>}
          </>
      )
  }

  return (
    <div className="space-y-6">
       <Button onClick={onBack} variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Saved Surveys
        </Button>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold">{survey.title}</CardTitle>
          <CardDescription className="text-center">Please answer the questions below.</CardDescription>
        </CardHeader>
        <form onSubmit={(e) => { e.preventDefault(); handleNext(); }}>
            <CardContent className="space-y-6 min-h-[300px]">
              <AnimatePresence mode="wait">
              {currentQuestionInfo ? (
                 <motion.div
                    key={currentQuestionInfo.path + (currentQuestionInfo.iteration || '')}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.3 }}
                    >
                        <div className="space-y-3">
                            <Label htmlFor={`answer-${currentQuestionInfo.question.id}`} className="text-lg font-semibold">
                                {currentQuestionInfo.question.text}
                                {currentQuestionInfo.iteration && ` (Member ${currentQuestionInfo.iteration})`}
                            </Label>
                            {renderInput(currentQuestionInfo)}
                        </div>
                 </motion.div>
              ) : (
                <motion.div
                    key="completion"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center h-full text-center"
                >
                    <h3 className="text-xl font-bold">You've completed the survey!</h3>
                    <p className="text-muted-foreground mt-2">Please enter your name (or submit anonymously) and click Submit.</p>
                     <div className="space-y-3 p-4 border rounded-lg bg-background mt-6 w-full max-w-sm">
                        <Label htmlFor="user-name">Your Name</Label>
                        <div className="flex items-center gap-4">
                            <div className="relative flex-1">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                            <Input id="user-name" placeholder="John Doe" value={userName} onChange={(e) => setUserName(e.target.value)} disabled={isAnonymous} className="pl-9" required={!isAnonymous}/>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2 pt-2">
                            <Checkbox id="anonymous" checked={isAnonymous} onCheckedChange={(checked) => setIsAnonymous(!!checked)} />
                            <Label htmlFor="anonymous" className="flex items-center gap-2 text-sm text-muted-foreground"><VenetianMask className="h-4 w-4" />Submit Anonymously</Label>
                        </div>
                    </div>
                </motion.div>
              )}
              </AnimatePresence>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row gap-2">
                {currentQuestionInfo ? (
                    <Button type="button" className="w-full" size="lg" onClick={handleNext} disabled={isNavigating}>
                        {isNavigating ? <Loader2 className="mr-2 animate-spin" /> : 'Next'} 
                        {!isNavigating && <ChevronsRight className="ml-2 h-4 w-4"/>}
                    </Button>
                ) : (
                    <Button type="button" onClick={handleSubmit} className="w-full" size="lg" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 animate-spin" /> : <Send className="mr-2"/>}
                        {isSubmitting ? 'Submitting...' : 'Submit Survey'}
                    </Button>
                )}
            </CardFooter>
        </form>
      </Card>
    </div>
  );
}
