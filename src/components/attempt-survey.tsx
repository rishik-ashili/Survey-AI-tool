
"use client";

import { useState, useMemo, Fragment, useEffect, useCallback } from 'react';
import type { SavedSurvey, SurveyQuestion, SubmissionMetadata, PersonalizedAnswer } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send, User, VenetianMask, Loader2, CheckCircle, Sparkles, MessageCircleQuestion, MapPin, Pause, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { submitSurvey, handleValidateAnswer, handleGeneratePersonalizedQuestions, submitPersonalizedAnswers } from '@/app/actions';
import { Separator } from './ui/separator';
import { useIsMobile } from '@/hooks/use-mobile';
import SurveyChatbot from './survey-chatbot';
import LanguageSelector from './language-selector';
import { useLanguage } from '@/contexts/language-context';
import TranslatableText, { TranslatableLabel, TranslatablePlaceholder } from './translatable-text';
import { useLiveTranslation } from '@/hooks/use-live-translation';


type AttemptSurveyProps = {
  survey: SavedSurvey;
  onBack: () => void;
};

type ValidationErrors = Record<string, string>;
type PersonalizedQuestion = { questionText: string };

export default function AttemptSurvey({ survey, onBack }: AttemptSurveyProps) {
  const { t } = useLanguage();
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userName, setUserName] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [metadata, setMetadata] = useState<SubmissionMetadata>({});
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isValidated, setIsValidated] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [showPersonalized, setShowPersonalized] = useState(false);
  const [personalizedQuestions, setPersonalizedQuestions] = useState<PersonalizedQuestion[]>([]);
  const [personalizedAnswers, setPersonalizedAnswers] = useState<Record<string, string>>({});
  const [isGeneratingPersonalized, setIsGeneratingPersonalized] = useState(false);
  const [isSubmittingPersonalized, setIsSubmittingPersonalized] = useState(false);
  const [locationStatus, setLocationStatus] = useState('Detecting location...');

  // Time tracking state
  const [questionStartTimes, setQuestionStartTimes] = useState<Record<string, number>>({});
  const [questionTimeTracking, setQuestionTimeTracking] = useState<Record<string, { startTime: number; pausedTime: number }>>({});

  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Time tracking functions
  const startQuestionTimer = useCallback((questionId: string) => {
    const now = Date.now();
    setQuestionStartTimes(prev => ({ ...prev, [questionId]: now }));
    setQuestionTimeTracking(prev => ({
      ...prev,
      [questionId]: { startTime: now, pausedTime: 0 }
    }));
  }, []);

  const pauseQuestionTimer = useCallback((questionId: string) => {
    if (questionStartTimes[questionId]) {
      const now = Date.now();
      const elapsed = now - questionStartTimes[questionId];
      setQuestionTimeTracking(prev => ({
        ...prev,
        [questionId]: {
          ...prev[questionId],
          pausedTime: (prev[questionId]?.pausedTime || 0) + elapsed
        }
      }));
    }
  }, [questionStartTimes]);

  const resumeQuestionTimer = useCallback((questionId: string) => {
    const now = Date.now();
    setQuestionStartTimes(prev => ({ ...prev, [questionId]: now }));
  }, []);

  const getQuestionTimeTaken = useCallback((questionId: string): number => {
    const tracking = questionTimeTracking[questionId];
    if (!tracking) return 0;

    const now = Date.now();
    const currentElapsed = now - questionStartTimes[questionId];
    return Math.round((tracking.pausedTime + currentElapsed) / 1000); // Convert to seconds
  }, [questionTimeTracking, questionStartTimes]);

  const togglePause = useCallback(() => {
    setIsPaused(prev => {
      const newPaused = !prev;

      // Pause/resume all active question timers
      Object.keys(questionStartTimes).forEach(questionId => {
        if (newPaused) {
          pauseQuestionTimer(questionId);
        } else {
          resumeQuestionTimer(questionId);
        }
      });

      return newPaused;
    });
  }, [questionStartTimes, pauseQuestionTimer, resumeQuestionTimer]);


  useEffect(() => {
    const fetchMetadata = async (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      let city = undefined;
      let country = undefined;

      try {
        setLocationStatus('Fetching location details...');
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        if (response.ok) {
          const data = await response.json();
          city = data.address.city || data.address.town || data.address.village;
          country = data.address.country;
          setLocationStatus(`Submitting from: ${city}, ${country}`);
        } else {
          setLocationStatus('Could not determine location.');
        }
      } catch (e) {
        console.warn("Could not fetch reverse geolocation data.", e);
        setLocationStatus('Could not determine location.');
      }

      setMetadata({
        latitude,
        longitude,
        city,
        country,
        device_type: isMobile ? 'mobile' : 'desktop'
      });
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        fetchMetadata,
        (error) => {
          console.warn(`Geolocation error: ${error.message}`);
          setLocationStatus('Geolocation is disabled.');
          // Still set device type even if location fails
          setMetadata(prev => ({ ...prev, device_type: isMobile ? 'mobile' : 'desktop' }));
        }
      );
    } else {
      setLocationStatus('Geolocation not supported.');
      setMetadata(prev => ({ ...prev, device_type: isMobile ? 'mobile' : 'desktop' }));
    }
  }, [isMobile]);


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


  const handleAnswerChange = (questionId: string, value: any, isIterative?: boolean, iterationIndex?: number) => {
    const timeTaken = getQuestionTimeTaken(questionId);

    if (isIterative) {
      setAnswers(prev => {
        const existing = prev[questionId] || { values: [] };
        const newValues = [...(existing.values || [])];
        newValues[iterationIndex!] = value;
        return {
          ...prev,
          [questionId]: {
            ...existing,
            values: newValues,
            timeTakenSeconds: timeTaken,
            questionStartedAt: new Date(questionStartTimes[questionId] || Date.now()).toISOString(),
            questionAnsweredAt: new Date().toISOString()
          }
        };
      });
    } else {
      setAnswers(prev => ({
        ...prev,
        [questionId]: {
          value,
          timeTakenSeconds: timeTaken,
          questionStartedAt: new Date(questionStartTimes[questionId] || Date.now()).toISOString(),
          questionAnsweredAt: new Date().toISOString()
        }
      }));
    }

    // Clear validation error for this question
    if (errors[questionId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[questionId];
        return newErrors;
      });
    }
  };

  const handleMultipleChoiceChange = (questionId: string, optionText: string, isChecked: boolean) => {
    setIsValidated(false); // Any change invalidates the form
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[questionId];
      return newErrors;
    });

    const answerData = answers[questionId];
    const currentAnswers = typeof answerData === 'object' ? (answerData?.value || []) : (answerData || []);
    const currentArray = Array.isArray(currentAnswers) ? currentAnswers : [];

    const newAnswers = isChecked
      ? [...currentArray, optionText]
      : currentArray.filter((ans) => ans !== optionText);
    handleAnswerChange(questionId, newAnswers);
  };

  const getIterationCount = useCallback((question: SurveyQuestion): number => {
    if (!question.is_iterative || !question.iterative_source_question_id) return 1;

    const sourceQuestion = Array.from(questionMap.values()).find(q => q.text === question.iterative_source_question_text);
    if (!sourceQuestion) return 1;

    const sourceAnswerRaw = answers[sourceQuestion.id];
    const sourceAnswer = typeof sourceAnswerRaw === 'object' ? (sourceAnswerRaw?.value ?? sourceAnswerRaw) : sourceAnswerRaw;
    const count = Number(sourceAnswer);
    return !isNaN(count) && count > 0 ? count : 0;
  }, [answers, questionMap]);

  const isQuestionVisible = useCallback((question: SurveyQuestion): boolean => {
    // Sub-question visibility depends on parent answer
    if (question.parent_question_id) {
      const parent = questionMap.get(question.parent_question_id);
      if (!parent || !isQuestionVisible(parent)) {
        return false;
      }
      const parentAnswerRaw = answers[question.parent_question_id];
      const parentAnswer = typeof parentAnswerRaw === 'object' ? (parentAnswerRaw?.value ?? parentAnswerRaw?.values) : parentAnswerRaw;
      if (parentAnswer === undefined || parentAnswer === null) {
        return false;
      }

      const trigger = String(question.trigger_condition_value).toLowerCase();
      const answerValue = Array.isArray(parentAnswer)
        ? parentAnswer.map(v => String(v).toLowerCase())
        : [String(parentAnswer).toLowerCase()];

      if (!answerValue.includes(trigger)) {
        return false;
      }
    }

    // Iterative question visibility depends on source question having a numeric answer
    if (question.is_iterative && question.iterative_source_question_text) {
      const sourceQuestion = Array.from(questionMap.values()).find(q => q.text === question.iterative_source_question_text);
      if (!sourceQuestion) return false;

      const sourceAnswerRaw = answers[sourceQuestion.id];
      const sourceAnswer = typeof sourceAnswerRaw === 'object' ? (sourceAnswerRaw?.value ?? sourceAnswerRaw) : sourceAnswerRaw;
      const count = Number(sourceAnswer);
      if (isNaN(count) || count <= 0) {
        return false;
      }
    }

    return true;
  }, [questionMap, answers]);

  const validateForm = async () => {
    let allValid = true;
    const newErrors: ValidationErrors = {};

    const questionsToValidate = Array.from(questionMap.values()).filter(q => isQuestionVisible(q));

    for (const question of questionsToValidate) {
      const answerData = answers[question.id];
      const iterationCount = getIterationCount(question);
      const isIterative = question.is_iterative && iterationCount > 0;

      if (isIterative) {
        for (let i = 0; i < iterationCount; i++) {
          const iterValue = (answerData?.values || [])[i];
          if (iterValue === undefined || iterValue === null || iterValue === '') {
            allValid = false;
            newErrors[`${question.id}-${i}`] = 'This field is required.';
          }
        }
      } else {
        const value = typeof answerData === 'object' ? answerData?.value : answerData;
        if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
          allValid = false;
          newErrors[question.id] = "This question is required.";
          continue; // Skip AI validation if it's empty
        }
      }

      // AI validation for text inputs
      if (question.type === 'text' && answerData && !isIterative) {
        const value = typeof answerData === 'object' ? String(answerData?.value ?? '') : String(answerData ?? '');
        if (value) {
          const validationInput: any = {
            question: question.text,
            answer: value,
          };

          // Only add expected_answers if it has a value
          if (question.expected_answers) {
            validationInput.expected_answers = question.expected_answers;
          }

          const validationResult = await handleValidateAnswer(validationInput);
          if (!validationResult.isValid) {
            allValid = false;
            newErrors[question.id] = validationResult.suggestion || "This answer seems invalid.";
          }
        }
      }
    }
    setErrors(newErrors);
    return allValid;
  }

  const handleValidateClick = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true); // Show loader on validate button
    const isValid = await validateForm();
    if (isValid) {
      setIsValidated(true);
      toast({ title: "Validation Successful!", description: "You can now submit the survey." });
    } else {
      setIsValidated(false);
      toast({ variant: "destructive", title: "Validation Failed", description: "Please review your answers." });
    }
    setIsSubmitting(false);
  }

  const handleSubmit = async () => {
    console.log('handleSubmit called!');
    setIsSubmitting(true);

    const { submissionId: newSubmissionId, error } = await submitSurvey(
      survey.id,
      answers,
      isAnonymous ? undefined : userName,
      metadata
    );

    if (error || !newSubmissionId) {
      toast({ variant: "destructive", title: "Error", description: error || 'Submission failed.' });
      setIsSubmitting(false);
      return;
    }

    setSubmissionId(newSubmissionId);

    console.log('Survey has personalized questions:', survey.has_personalized_questions);

    if (survey.has_personalized_questions) {
      console.log('Generating personalized questions for submission:', newSubmissionId);
      setIsGeneratingPersonalized(true);

      try {
        const { data: personalizedData, error: personalizedError } = await handleGeneratePersonalizedQuestions(newSubmissionId);
        setIsGeneratingPersonalized(false);

        console.log('Personalized questions result:', { personalizedData, personalizedError });

        if (personalizedError) {
          console.error('Error generating personalized questions:', personalizedError);
          toast({ variant: "destructive", title: "Error", description: personalizedError });
          setIsSubmitting(false);
          return;
        }

        const questions = personalizedData?.questions || [];
        console.log('Setting personalized questions:', questions);
        setPersonalizedQuestions(questions);
        setShowPersonalized(true);
        console.log('Show personalized set to true');
      } catch (error) {
        console.error('Exception in personalized questions generation:', error);
        setIsGeneratingPersonalized(false);
        toast({ variant: "destructive", title: "Error", description: "Failed to generate personalized questions" });
        setIsSubmitting(false);
        return;
      }
    } else {
      console.log('No personalized questions for this survey');
      toast({ title: "Success", description: "Survey submitted successfully!" });
      onBack();
    }

    setIsSubmitting(false);
  };

  const triggerPersonalizedQuestions = async (currentSubmissionId: string) => {
    setIsGeneratingPersonalized(true);
    setShowPersonalized(true);
    setSubmissionId(currentSubmissionId); // Make sure submissionId is set for the personalized submit

    const formattedAnswers = Object.entries(answers).map(([qId, answerData]) => {
      const questionText = questionMap.get(qId)?.text || '';
      const answer = typeof answerData === 'object' ?
        (answerData?.value ?? answerData?.values ?? answerData) :
        answerData;
      return { question: questionText, answer: String(answer) };
    }).filter(a => a.question);

    const result = await handleGeneratePersonalizedQuestions(currentSubmissionId);
    setPersonalizedQuestions(result.data?.questions || []);
    setIsGeneratingPersonalized(false);
  };

  const handlePersonalizedAnswerChange = (questionText: string, answerText: string) => {
    setPersonalizedAnswers(prev => ({ ...prev, [questionText]: answerText }));
  }

  const handlePersonalizedSubmit = async () => {
    if (!submissionId) return;

    setIsSubmittingPersonalized(true);
    const { error } = await submitPersonalizedAnswers(submissionId, personalizedAnswers);
    setIsSubmittingPersonalized(false);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not save your additional answers." });
    } else {
      toast({ title: "Thank you!", description: "Your feedback is valuable." });
    }
    onBack(); // Go back after submitting
  };


  // Effect to start timers for visible questions
  useEffect(() => {
    const visibleQuestions = Array.from(questionMap.values()).filter(q => {
      try {
        return isQuestionVisible(q);
      } catch {
        return false;
      }
    });

    visibleQuestions.forEach(q => {
      if (!questionStartTimes[q.id]) {
        startQuestionTimer(q.id);
      }
    });
  }, [questionMap, isQuestionVisible, questionStartTimes, startQuestionTimer, answers]);

  const renderQuestion = (question: SurveyQuestion, index: number, isSubQuestion: boolean = false) => {
    if (!isQuestionVisible(question)) {
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
              const answerData = answers[question.id];
              const value = isIterative ? (answerData?.values || [])[iterIndex] : answerData?.value;
              const error = errors[isIterative ? `${question.id}-${iterIndex}` : question.id];

              return (
                <div key={uniqueId} className="space-y-3 animate-fade-in py-4">
                  <Label htmlFor={`answer-${uniqueId}`} className="text-base flex gap-2">
                    {(!isIterative && !isSubQuestion) && <span>{index + 1}.</span>}
                    <TranslatableText>
                      {question.text}
                      {isIterative && ` (Entry ${iterIndex + 1})`}
                    </TranslatableText>
                  </Label>

                  {(() => {
                    switch (question.type) {
                      case 'text':
                        return <Textarea placeholder={useLiveTranslation('Type your answer here...')} value={value || ''} onChange={e => handleAnswerChange(question.id, e.target.value, isIterative, iterIndex)} className={error ? 'border-destructive' : ''} />;
                      case 'number':
                        return <Input type="number" placeholder={useLiveTranslation('Enter a number')} value={value || ''} onChange={e => handleAnswerChange(question.id, e.target.value, isIterative, iterIndex)} className={error ? 'border-destructive' : ''} />;
                      case 'yes-no':
                        return <RadioGroup onValueChange={(v) => handleAnswerChange(question.id, v, isIterative, iterIndex)} value={value || ''}>
                          <div className="flex items-center space-x-2"><RadioGroupItem value="Yes" id={`yes-${uniqueId}`} /><Label htmlFor={`yes-${uniqueId}`}><TranslatableText>Yes</TranslatableText></Label></div>
                          <div className="flex items-center space-x-2"><RadioGroupItem value="No" id={`no-${uniqueId}`} /><Label htmlFor={`no-${uniqueId}`}><TranslatableText>No</TranslatableText></Label></div>
                        </RadioGroup>;
                      case 'multiple-choice':
                        return <RadioGroup onValueChange={(v) => handleAnswerChange(question.id, v, isIterative, iterIndex)} value={value || ''} className="space-y-2">
                          {question.options?.map(opt => <div key={opt.id} className="flex items-center space-x-2"><RadioGroupItem value={opt.text} id={`mc-${uniqueId}-${opt.id}`} /><Label htmlFor={`mc-${uniqueId}-${opt.id}`}><TranslatableText>{opt.text}</TranslatableText></Label></div>)}
                        </RadioGroup>;
                      case 'multiple-choice-multi':
                        return <div className="space-y-2">
                          {question.options?.map(option => {
                            const answerData = answers[question.id];
                            const currentAnswers = typeof answerData === 'object' ? (answerData?.value || []) : (answerData || []);
                            const isChecked = Array.isArray(currentAnswers) && currentAnswers.includes(option.text);
                            return (
                              <div key={option.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`mcm-${uniqueId}-${option.id}`}
                                  onCheckedChange={(checked) => handleMultipleChoiceChange(question.id, option.text, !!checked)}
                                  checked={isChecked}
                                />
                                <Label htmlFor={`mcm-${uniqueId}-${option.id}`}><TranslatableText>{option.text}</TranslatableText></Label>
                              </div>
                            );
                          })}
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


  if (submissionId && showPersonalized) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="w-full">
          <h2 className="text-2xl font-bold tracking-tight mb-4">Thank You!</h2>
          <p className="text-muted-foreground mb-6">Your response has been recorded.</p>

          {survey.has_personalized_questions && (
            <Card className="mt-8 text-left p-6 w-full max-w-lg mx-auto">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="flex items-center gap-2"><Sparkles className="text-primary" /> One last thing... (Optional)</CardTitle>
                <CardDescription>Based on your answers, we have a few more questions for you.</CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-4">
                {isGeneratingPersonalized ? (
                  <div className="flex items-center justify-center p-8"><Loader2 className="animate-spin" /> Generating Questions...</div>
                ) : personalizedQuestions.length > 0 ? (
                  <>
                    {personalizedQuestions.map((q, i) => (
                      <div key={i} className="space-y-2">
                        <Label>{q.questionText}</Label>
                        <Textarea onChange={(e) => handlePersonalizedAnswerChange(q.questionText, e.target.value)} />
                      </div>
                    ))}
                    <Button onClick={handlePersonalizedSubmit} disabled={isSubmittingPersonalized} className="w-full mt-4">
                      {isSubmittingPersonalized ? <Loader2 className="animate-spin" /> : <Send />}
                      {isSubmittingPersonalized ? 'Saving...' : 'Submit Final Answers'}
                    </Button>
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">No personalized questions were generated.</p>
                )}
              </CardContent>
            </Card>
          )}

          <Button onClick={onBack} className="mt-8">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Saved Surveys
          </Button>
        </motion.div>
      </div>
    )
  }

  const allQuestions = Array.from(questionMap.values());


  return (
    <div className="space-y-6">
      <Button onClick={onBack} variant="ghost" className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Saved Surveys
      </Button>
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{survey.title}</CardTitle>
              <CardDescription>{survey.description}</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <LanguageSelector />
              <Button
                variant="outline"
                size="sm"
                onClick={togglePause}
                className="flex items-center gap-2"
              >
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                {isPaused ? useLiveTranslation('Resume') : useLiveTranslation('Pause')}
              </Button>
            </div>
          </div>
          {isPaused && (
            <div className="mt-2 text-center text-sm text-muted-foreground">
              <TranslatableText>Survey Paused</TranslatableText>
            </div>
          )}
          <CardDescription className="text-center flex flex-col items-center gap-2">
            <TranslatableText>Please answer the questions below.</TranslatableText>
            <span className="flex items-center gap-2 text-xs text-muted-foreground p-2 rounded-md bg-muted">
              <MapPin className="h-4 w-4" /> {locationStatus}
            </span>
          </CardDescription>
        </CardHeader>
        <form onSubmit={(e) => e.preventDefault()}>
          <CardContent className="space-y-6">
            {survey.questions.map((q, i) => renderQuestion(q, i))}

            <Separator />

            <div className="space-y-3 p-4 border rounded-lg bg-background mt-6 w-full">
              <h3 className="text-lg font-semibold"><TranslatableText>Your Information</TranslatableText></h3>
              <Label htmlFor="user-name"><TranslatableText>Your Name</TranslatableText></Label>
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="user-name" placeholder={useLiveTranslation('Enter your name')} value={userName} onChange={(e) => setUserName(e.target.value)} disabled={isAnonymous} className="pl-9" required={!isAnonymous} />
                </div>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox id="anonymous" checked={isAnonymous} onCheckedChange={(checked) => setIsAnonymous(!!checked)} />
                <Label htmlFor="anonymous" className="flex items-center gap-2 text-sm text-muted-foreground"><VenetianMask className="h-4 w-4" /><TranslatableText>Submit Anonymously</TranslatableText></Label>
              </div>
            </div>

          </CardContent>
          <CardFooter>
            {!isValidated ? (
              <Button onClick={handleValidateClick} className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 animate-spin" /> : <CheckCircle className="mr-2" />}
                {isSubmitting ? 'Validating...' : 'Validate Answers'}
              </Button>
            ) : (
              <Button onClick={handleSubmit} className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 animate-spin" /> : <Send className="mr-2" />}
                {isSubmitting ? useLiveTranslation('Submitting...') : useLiveTranslation('Submit Survey')}
              </Button>
            )}
          </CardFooter>
        </form>
      </Card>
      <SurveyChatbot
        questions={survey.questions}
        onAnswerChange={handleAnswerChange}
        onSubmit={handleSubmit}
        currentAnswers={answers}
        isQuestionVisible={isQuestionVisible}
        getIterationCount={getIterationCount}
      />
    </div>
  );
}
