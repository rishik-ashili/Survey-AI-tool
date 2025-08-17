
"use client";

import { useState, useEffect, useMemo } from 'react';
import type { SavedSurvey, SurveyQuestion, SubmissionMetadata } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send, Minus, Plus, User, VenetianMask, Laptop, Smartphone, ShieldCheck, Loader2, ChevronsRight, CornerDownRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { submitSurvey, handleValidateAnswer } from '@/app/actions';
import { useIsMobile } from '@/hooks/use-mobile';
import { Progress } from './ui/progress';


type AttemptSurveyProps = {
  survey: SavedSurvey;
  onBack: () => void;
};

type ValidationErrors = Record<string, { message: string, suggestion?: string }>;

type CurrentQuestionInfo = {
    question: SurveyQuestion;
    path: string; // e.g., "0" for the first question, "0.1" for its second sub-question
    iteration?: number; // e.g., 1 for the first family member
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
  const isMobile = useIsMobile();
  const [history, setHistory] = useState<CurrentQuestionInfo[]>([]);
  const [currentQuestionInfo, setCurrentQuestionInfo] = useState<CurrentQuestionInfo | null>(null);

  const questionMap = useMemo(() => {
    const map = new Map<string, SurveyQuestion>();
    const traverse = (questions: SurveyQuestion[]) => {
        questions.forEach(q => {
            map.set(q.id, q);
            if (q.sub_questions) {
                traverse(q.sub_questions);
            }
        });
    }
    traverse(survey.questions);
    return map;
  }, [survey.questions]);

  useEffect(() => {
    // Initialize with the first question
    if (survey.questions.length > 0) {
        setCurrentQuestionInfo({ question: survey.questions[0], path: '0' });
    }
  }, [survey.questions]);

  const findNextQuestion = (currentInfo: CurrentQuestionInfo, lastAnswer: any): CurrentQuestionInfo | null => {
      const currentQuestion = currentInfo.question;

      // 1. Check for triggered sub-questions
      if (currentQuestion.sub_questions && currentQuestion.sub_questions.length > 0) {
          const triggeredSubQuestion = currentQuestion.sub_questions.find(
              sq => sq.trigger_condition_value === String(lastAnswer)
          );
          if (triggeredSubQuestion) {
               const subQuestionIndex = currentQuestion.sub_questions.indexOf(triggeredSubQuestion);
              return { question: triggeredSubQuestion, path: `${currentInfo.path}.${subQuestionIndex}` };
          }
      }

      // 2. Check for iteration
      const nextIterationQuestion = [...questionMap.values()].find(q => q.is_iterative && q.iterative_source_question_id === currentQuestion.id);
      if (nextIterationQuestion && !isNaN(Number(lastAnswer)) && Number(lastAnswer) > 0) {
          const iterativeQuestionIndex = [...questionMap.values()].indexOf(nextIterationQuestion);
          return { question: nextIterationQuestion, path: `q${iterativeQuestionIndex}`, iteration: 1 };
      }


      // 3. Move to next sibling or parent's sibling
      const pathParts = currentInfo.path.split('.').map(part => isNaN(Number(part)) ? part : Number(part));
      
      let currentLevelQuestions = survey.questions;
      let parentPath = '';


      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (typeof part === 'number') {
            const parent = currentLevelQuestions[part];
            if (parent) {
                currentLevelQuestions = parent?.sub_questions || [];
                parentPath = parentPath ? `${parentPath}.${part}` : `${part}`;
            }
        }
      }
      
      const currentIndex = pathParts[pathParts.length - 1];
      if (typeof currentIndex === 'number' && currentIndex + 1 < currentLevelQuestions.length) {
          const nextSibling = currentLevelQuestions[currentIndex + 1];
          pathParts[pathParts.length - 1]++;
          return { question: nextSibling, path: pathParts.join('.') };
      }

      // If no next sibling, we're done with this branch, return null to signify moving up.
      return null;
  }
  
  const getNextQuestion = (lastAnswer: any) => {
      let nextInfo: CurrentQuestionInfo | null = null;
      let tempHistory = [...history];
      
      if (currentQuestionInfo) {
        // Handle iterative logic
        if (currentQuestionInfo.iteration) {
            const sourceQuestionId = currentQuestionInfo.question.iterative_source_question_id;
            const sourceAnswer = sourceQuestionId ? answers[sourceQuestionId] : 0;
            const totalIterations = Number(sourceAnswer);

            if (currentQuestionInfo.iteration < totalIterations) {
                // Stay on the same question, just increment iteration
                return { ...currentQuestionInfo, iteration: currentQuestionInfo.iteration + 1 };
            } 
            // Iteration finished, find what's next after the source question
            const sourceQuestionInfo = tempHistory.find(h => h.question.id === sourceQuestionId) || currentQuestionInfo;
             if (sourceQuestionInfo) {
                nextInfo = findNextQuestion(sourceQuestionInfo, sourceAnswer);
                const sourceQuestionIndexInHistory = tempHistory.findIndex(h => h.question.id === sourceQuestionId);
                if (sourceQuestionIndexInHistory > -1) {
                  tempHistory = tempHistory.slice(0, sourceQuestionIndexInHistory + 1);
                }
            }
        } else {
            nextInfo = findNextQuestion(currentQuestionInfo, lastAnswer);
        }
      }
      
      // Traverse up the history if no direct next question is found
      while (!nextInfo && tempHistory.length > 0) {
          const lastStep = tempHistory.pop()!;
          const lastStepAnswer = answers[lastStep.question.id];
          nextInfo = findNextQuestion(lastStep, lastStepAnswer);
      }
      
      return nextInfo;
  }

  const handleNext = async () => {
    if (!currentQuestionInfo) return;
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
        return;
    }
    
     const validationInput = {
        question: question.text,
        answer: String(answer),
        expected_answers: question.expected_answers,
        // Example context, can be made dynamic later
        context: 'This survey is for residents of India.' 
    };

    if (question.type === 'text') {
        const validationResult = await handleValidateAnswer(validationInput);
        if (!validationResult.isValid) {
            setErrors({[question.id]: { message: validationResult.suggestion, suggestion: validationResult.suggestion }});
            return;
        }
    }


    const nextInfo = getNextQuestion(answer);
    
    if (nextInfo) {
        setHistory(prev => [...prev, currentQuestionInfo]);
        setCurrentQuestionInfo(nextInfo);
    } else {
        // No more questions, survey is finished
        setHistory(prev => [...prev, currentQuestionInfo]);
        setCurrentQuestionInfo(null);
        toast({ title: "All questions answered!", description: "You can now submit your survey."})
    }
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
                    <Button type="button" className="w-full" size="lg" onClick={handleNext}>
                        Next <ChevronsRight className="ml-2 h-4 w-4"/>
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
 
    

    