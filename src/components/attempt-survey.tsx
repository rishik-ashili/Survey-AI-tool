
"use client";

import { useState, useMemo, Fragment, useEffect, useCallback } from 'react';
import type { SavedSurvey, SurveyQuestion, SubmissionMetadata } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send, User, VenetianMask, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { submitSurvey, handleValidateAnswer, handleShouldAskQuestion } from '@/app/actions';
import { Separator } from './ui/separator';

type AttemptSurveyProps = {
  survey: SavedSurvey;
  onBack: () => void;
};

type ValidationErrors = Record<string, string>;
type QuestionVisibility = Record<string, boolean>;

export default function AttemptSurvey({ survey, onBack }: AttemptSurveyProps) {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userName, setUserName] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [metadata, setMetadata] = useState<SubmissionMetadata>({});
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [visibility, setVisibility] = useState<QuestionVisibility>({});

  const { toast } = useToast();

  const questionMap = useMemo(() => {
      const map = new Map<string, SurveyQuestion>();
      const addQuestionsToMap = (questions: SurveyQuestion[]) => {
          for (const q of questions) {
              map.set(q.id, q);
              if (q.sub_questions) {
                  addQuestionsToMap(q.sub_questions);
              }
          }
      };
      addQuestionsToMap(survey.questions);
      return map;
  }, [survey.questions]);

  // This effect hook will run whenever answers change to update question visibility
  useEffect(() => {
    const updateVisibility = async () => {
      const newVisibility: QuestionVisibility = {};
      const answerHistory: { question: string; answer: string; }[] = [];

      const processQuestions = async (questions: SurveyQuestion[], parentIsVisible: boolean) => {
        for (const question of questions) {
          let shouldShow = parentIsVisible;

          // Rule 1: Sub-question visibility depends on parent answer
          if (shouldShow && question.parent_question_id) {
            const parentAnswer = answers[question.parent_question_id];
            // Using String() to handle different types and checking against trigger value
            if (Array.isArray(parentAnswer) ? !parentAnswer.includes(String(question.trigger_condition_value)) : String(parentAnswer).toLowerCase() !== String(question.trigger_condition_value).toLowerCase()) {
              shouldShow = false;
            }
          }
          
          // Rule 2: Iterative question visibility depends on source question having a numeric answer
          if (shouldShow && question.is_iterative && question.iterative_source_question_id) {
             const sourceAnswer = answers[question.iterative_source_question_id];
             const count = Number(sourceAnswer);
             if (isNaN(count) || count <= 0) {
                shouldShow = false;
             }
          }

          // Rule 3: Use AI to determine if a question is relevant
          if (shouldShow && answerHistory.length > 0) {
             try {
                const aiCheck = await handleShouldAskQuestion({
                    question: question.text,
                    previousAnswers: answerHistory,
                });
                if (!aiCheck.shouldAsk) {
                    shouldShow = false;
                }
             } catch(e) {
                console.error("AI visibility check failed", e);
             }
          }

          newVisibility[question.id] = shouldShow;
          
          // If the question is visible, add its answer to history for subsequent checks
          if (shouldShow && answers[question.id] !== undefined) {
             const answerValue = Array.isArray(answers[question.id]) ? answers[question.id].join(', ') : String(answers[question.id]);
             if (answerValue) {
                answerHistory.push({ question: question.text, answer: answerValue});
             }
          }
          
          // Recursively process sub-questions
          if (question.sub_questions) {
            await processQuestions(question.sub_questions, shouldShow);
          }
        }
      };

      await processQuestions(survey.questions, true);
      setVisibility(newVisibility);
    };
    
    updateVisibility();
  }, [answers, survey.questions]);


  const handleAnswerChange = (questionId: string, value: any, isIterative: boolean = false, iterationIndex?: number) => {
    setErrors(prev => {
      const newErrors = {...prev};
      const errorKey = isIterative && iterationIndex !== undefined ? `${questionId}-${iterationIndex}` : questionId;
      delete newErrors[errorKey];
      return newErrors;
    });
    
    if (isIterative && iterationIndex !== undefined) {
      setAnswers(prev => {
        const existingValues = (prev[questionId] && prev[questionId].values) ? [...prev[questionId].values] : [];
        existingValues[iterationIndex] = value;
        return { ...prev, [questionId]: { isIterative: true, values: existingValues } };
      });
    } else {
      setAnswers(prev => ({ ...prev, [questionId]: value }));
    }
  };
  
  const handleMultipleChoiceChange = (questionId: string, optionText: string, isChecked: boolean) => {
    setErrors(prev => {
      const newErrors = {...prev};
      delete newErrors[questionId];
      return newErrors;
    });

    const currentAnswers = (answers[questionId] as string[] | undefined) || [];
    const newAnswers = isChecked
      ? [...currentAnswers, optionText]
      : currentAnswers.filter((ans) => ans !== optionText);
    handleAnswerChange(questionId, newAnswers);
  };

  const getIterationCount = (question: SurveyQuestion): number => {
    if (!question.is_iterative || !question.iterative_source_question_id) return 1;
    const sourceAnswer = answers[question.iterative_source_question_id];
    const count = Number(sourceAnswer);
    return !isNaN(count) && count > 0 ? count : 0;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});
    
    let allValid = true;
    const newErrors: ValidationErrors = {};

    const questionsToValidate = Array.from(questionMap.values()).filter(q => visibility[q.id]);

    for (const question of questionsToValidate) {
        const answer = answers[question.id];
        const iterationCount = getIterationCount(question);
        const isIterative = question.is_iterative && iterationCount > 0;

        if(isIterative) {
            for(let i = 0; i < iterationCount; i++) {
                const iterValue = (answer?.values || [])[i];
                if(iterValue === undefined || iterValue === null || iterValue === '') {
                    allValid = false;
                    newErrors[`${question.id}-${i}`] = 'This field is required.';
                }
            }
        } else if (answer === undefined || answer === null || answer === '' || (Array.isArray(answer) && answer.length === 0)) {
            allValid = false;
            newErrors[question.id] = "This question is required.";
            continue; // Skip AI validation if it's empty
        }
      
      // AI validation for text inputs
      if (question.type === 'text' && answer && !isIterative) {
          const validationResult = await handleValidateAnswer({
            question: question.text,
            answer: String(answer),
            expected_answers: question.expected_answers,
          });
          if (!validationResult.isValid) {
            allValid = false;
            newErrors[question.id] = validationResult.suggestion || "This answer seems invalid.";
          }
      }
    }

    if (!allValid) {
      setErrors(newErrors);
      toast({ variant: "destructive", title: "Validation Failed", description: "Please review your answers." });
      setIsSubmitting(false);
      return;
    }

    const { error } = await submitSurvey(survey.id, answers, isAnonymous ? undefined : userName, metadata);
    setIsSubmitting(false);

    if (error) {
         toast({ variant: "destructive", title: "Submission Failed", description: "Something went wrong. Please try again." });
    } else {
        setSubmitted(true);
        toast({ title: "Survey Submitted!", description: "Thank you for your feedback." });
    }
  };
  
  const renderQuestion = (question: SurveyQuestion, index: number, isSubQuestion: boolean = false) => {
      if (visibility[question.id] === false) {
          return null;
      }
      
      const iterationCount = getIterationCount(question);
      const isIterative = question.is_iterative && iterationCount > 0;

      return (
        <Fragment key={question.id}>
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`space-y-4 ${isSubQuestion ? 'ml-6 pl-6 border-l-2' : ''}`}
            >
              {[...Array(iterationCount)].map((_, iterIndex) => {
                  const uniqueId = question.id + (isIterative ? `-${iterIndex}` : '');
                  const value = isIterative ? (answers[question.id]?.values || [])[iterIndex] : answers[question.id];
                  const error = errors[isIterative ? `${question.id}-${iterIndex}` : question.id];

                  return (
                    <div key={uniqueId} className="space-y-3 animate-fade-in py-4">
                       <Label htmlFor={`answer-${uniqueId}`} className="text-base flex gap-2">
                        {(!isIterative && !isSubQuestion) && <span>{index + 1}.</span>}
                        {question.text}
                        {isIterative && ` (Entry ${iterIndex + 1})`}
                      </Label>
                      
                      {(() => {
                        switch(question.type) {
                            case 'text':
                                return <Textarea placeholder="Your answer..." value={value || ''} onChange={e => handleAnswerChange(question.id, e.target.value, isIterative, iterIndex)} className={error ? 'border-destructive' : ''} />;
                            case 'number':
                                return <Input type="number" placeholder="Enter a number" value={value || ''} onChange={e => handleAnswerChange(question.id, e.target.value, isIterative, iterIndex)} className={error ? 'border-destructive' : ''} />;
                            case 'yes-no':
                                return <RadioGroup onValueChange={(v) => handleAnswerChange(question.id, v, isIterative, iterIndex)} value={value || ''}>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Yes" id={`yes-${uniqueId}`} /><Label htmlFor={`yes-${uniqueId}`}>Yes</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="No" id={`no-${uniqueId}`} /><Label htmlFor={`no-${uniqueId}`}>No</Label></div>
                                </RadioGroup>;
                            case 'multiple-choice':
                                return <RadioGroup onValueChange={(v) => handleAnswerChange(question.id, v, isIterative, iterIndex)} value={value || ''} className="space-y-2">
                                    {question.options?.map(opt => <div key={opt.id} className="flex items-center space-x-2"><RadioGroupItem value={opt.text} id={`mc-${uniqueId}-${opt.id}`} /><Label htmlFor={`mc-${uniqueId}-${opt.id}`}>{opt.text}</Label></div>)}
                                </RadioGroup>;
                            case 'multiple-choice-multi':
                                return <div className="space-y-2">
                                {question.options?.map(option => (
                                    <div key={option.id} className="flex items-center space-x-2">
                                        <Checkbox id={`mcm-${uniqueId}-${option.id}`} onCheckedChange={(checked) => handleMultipleChoiceChange(question.id, option.text, !!checked)} checked={((answers[question.id] as string[]) || []).includes(option.text)} />
                                        <Label htmlFor={`mcm-${uniqueId}-${option.id}`}>{option.text}</Label>
                                    </div>
                                ))}
                                </div>;
                            default: return null;
                        }
                      })()}
                      {error && <p className="text-sm text-destructive mt-2">{error}</p>}
                      
                      {!isIterative && question.sub_questions?.map((sub, subIndex) => renderQuestion(sub, subIndex, true))}
                    </div>
                  );
              })}
            </motion.div>
          </AnimatePresence>
          {!isSubQuestion && index < survey.questions.length - 1 && <Separator />}
        </Fragment>
      );
  }

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
        <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              {survey.questions.map((q, i) => renderQuestion(q, i))}
              
              <Separator />

              <div className="space-y-3 p-4 border rounded-lg bg-background mt-6 w-full">
                <h3 className="text-lg font-semibold">Your Information</h3>
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

            </CardContent>
            <CardFooter>
                 <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 animate-spin" /> : <Send className="mr-2"/>}
                    {isSubmitting ? 'Submitting...' : 'Submit Survey'}
                </Button>
            </CardFooter>
        </form>
      </Card>
    </div>
  );
}
