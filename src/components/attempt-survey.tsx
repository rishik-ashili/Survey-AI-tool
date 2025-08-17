
"use client";

import { useState, useEffect } from 'react';
import type { SavedSurvey, SubmissionMetadata } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send, Minus, Plus, User, VenetianMask, Laptop, Smartphone, ShieldCheck, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { submitSurvey, handleValidateAnswer } from '@/app/actions';
import { useIsMobile } from '@/hooks/use-mobile';


type AttemptSurveyProps = {
  survey: SavedSurvey;
  onBack: () => void;
};

type ValidationErrors = Record<string, { message: string, suggestion?: string }>;

export default function AttemptSurvey({ survey, onBack }: AttemptSurveyProps) {
  const [answers, setAnswers] = useState<Record<string, string | number | string[]>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitEnabled, setIsSubmitEnabled] = useState(false);
  const [userName, setUserName] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [metadata, setMetadata] = useState<SubmissionMetadata>({});
  const [errors, setErrors] = useState<ValidationErrors>({});
  const { toast } = useToast();
  const isMobile = useIsMobile();


  useEffect(() => {
    const getMetadata = async () => {
       const device_type = isMobile ? 'mobile' : 'desktop';
       const partialMetadata: SubmissionMetadata = { device_type };

       try {
           const position = await new Promise<GeolocationPosition>((resolve, reject) => {
               navigator.geolocation.getCurrentPosition(resolve, reject, {
                   timeout: 5000,
               });
           });

           partialMetadata.latitude = position.coords.latitude;
           partialMetadata.longitude = position.coords.longitude;

           try {
            const geoResponse = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&localityLanguage=en`);
            const geoData = await geoResponse.json();
            partialMetadata.city = geoData.city;
            partialMetadata.country = geoData.countryName;
           } catch(geoError) {
             console.warn("Could not fetch city/country", geoError);
           }
       } catch (error) {
           console.warn('Could not get location:', error);
           toast({
                variant: 'default',
                title: "Location not shared",
                description: "You chose not to share your location.",
            });
       }
       setMetadata(partialMetadata);
    }
    
    getMetadata();
  }, [isMobile, toast]);


  const handleAnswerChange = (questionId: string, value: string | number | string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    // Reset validation state on change
    setIsSubmitEnabled(false);
    if(errors[questionId]) {
        setErrors(prev => {
            const newErrors = {...prev};
            delete newErrors[questionId];
            return newErrors;
        })
    }
  };

  const handleMultipleChoiceChange = (questionId: string, optionText: string, isChecked: boolean) => {
    const currentAnswers = (answers[questionId] as string[] | undefined) || [];
    const newAnswers = isChecked
      ? [...currentAnswers, optionText]
      : currentAnswers.filter((ans) => ans !== optionText);
    handleAnswerChange(questionId, newAnswers);
  };


  const handleValidate = async () => {
    setIsValidating(true);
    const newErrors: ValidationErrors = {};

    for (const question of survey.questions) {
        const answer = answers[question.id];

        // 1. Check if answered
        if (answer === undefined || answer === '' || (Array.isArray(answer) && answer.length === 0)) {
            newErrors[question.id] = { message: 'This question is required.' };
            continue;
        }
        
        // 2. Client-side validation
        if (question.type === 'number') {
            const numValue = Number(answer);
            if (isNaN(numValue)) {
                newErrors[question.id] = { message: 'Please enter a valid number.'};
                continue;
            }
            // Check for range in question text e.g., "on a scale of 1 to 5"
            const rangeMatch = question.text.match(/(\d+)\s*to\s*(\d+)/);
            if (rangeMatch) {
                const min = parseInt(rangeMatch[1], 10);
                const max = parseInt(rangeMatch[2], 10);
                if (numValue < min || numValue > max) {
                    newErrors[question.id] = { message: `Your answer must be between ${min} and ${max}.` };
                    continue;
                }
            }
        }
        
        // 3. AI validation for text questions
        if (question.type === 'text') {
            const result = await handleValidateAnswer({ question: question.text, answer: String(answer) });
            if (!result.isValid) {
                newErrors[question.id] = { message: `Your answer seems off-topic.`, suggestion: result.suggestion };
            }
        }
    }
    
    setErrors(newErrors);
    setIsValidating(false);

    if (Object.keys(newErrors).length === 0) {
        setIsSubmitEnabled(true);
        toast({
            title: "Validation Successful!",
            description: "You can now submit your survey.",
        });
    } else {
        setIsSubmitEnabled(false);
         toast({
            variant: "destructive",
            title: "Validation Failed",
            description: "Please fix the errors before submitting.",
        });
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSubmitEnabled) {
         toast({
            variant: "destructive",
            title: "Not Validated",
            description: "Please validate your answers before submitting.",
        });
        return;
    }
    if (!isAnonymous && !userName) {
        toast({
            variant: "destructive",
            title: "Name Required",
            description: "Please enter your name or check the anonymous box.",
        });
        return;
    }

    setIsSubmitting(true);
    const { error } = await submitSurvey(survey.id, answers, isAnonymous ? undefined : userName, metadata);
    setIsSubmitting(false);

    if (error) {
         toast({
            variant: "destructive",
            title: "Submission Failed",
            description: "Something went wrong. Please try again.",
        });
    } else {
        setSubmitted(true);
        toast({
            title: "Survey Submitted!",
            description: "Thank you for your feedback.",
        });
    }
  };
  
  const renderInput = (question: SavedSurvey['questions'][0]) => {
      const value = answers[question.id];
      const error = errors[question.id];

      return (
          <>
            {(() => {
                switch (question.type) {
                    case 'number':
                        return (
                             <div className="flex items-center gap-2">
                                <Button type="button" size="icon" variant="outline" onClick={() => handleAnswerChange(question.id, (Number(value) || 0) - 1)}>
                                    <Minus className="h-4 w-4"/>
                                </Button>
                                <Input
                                    id={`answer-${question.id}`}
                                    type="number"
                                    value={value || ''}
                                    onChange={(e) => handleAnswerChange(question.id, e.target.valueAsNumber)}
                                    required
                                    className={`text-center ${error ? 'border-destructive' : ''}`}
                                />
                                <Button type="button" size="icon" variant="outline" onClick={() => handleAnswerChange(question.id, (Number(value) || 0) + 1)}>
                                    <Plus className="h-4 w-4"/>
                                </Button>
                            </div>
                        )
                    case 'yes-no':
                        return (
                            <RadioGroup
                                    id={`answer-${question.id}`}
                                    onValueChange={(v) => handleAnswerChange(question.id, v)}
                                    value={value as string || ''}
                                    className={`flex gap-4 ${error ? 'rounded-md border border-destructive p-2' : ''}`}
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="yes" id={`yes-${question.id}`} />
                                        <Label htmlFor={`yes-${question.id}`}>Yes</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="no" id={`no-${question.id}`} />
                                        <Label htmlFor={`no-${question.id}`}>No</Label>
                                    </div>
                                </RadioGroup>
                        )
                    case 'multiple-choice':
                        return (
                            <div id={`answer-${question.id}`} className={`space-y-2 ${error ? 'rounded-md border border-destructive p-2' : ''}`}>
                                {question.options?.map(option => (
                                    <div key={option.id} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`${question.id}-${option.id}`}
                                            onCheckedChange={(checked) => handleMultipleChoiceChange(question.id, option.text, !!checked)}
                                            checked={((answers[question.id] as string[]) || []).includes(option.text)}
                                        />
                                        <Label htmlFor={`${question.id}-${option.id}`}>{option.text}</Label>
                                    </div>
                                ))}
                            </div>
                        )
                    case 'text':
                    default:
                        return (
                            <Textarea
                                    id={`answer-${question.id}`}
                                    placeholder="Your answer..."
                                    value={value as string || ''}
                                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                    required
                                    className={`min-h-[100px] ${error ? 'border-destructive' : ''}`}
                                />
                        )
                }
            })()}
            {error && <p className="text-sm text-destructive mt-2">{error.message}</p>}
            {error?.suggestion && <p className="text-sm text-green-600 mt-1">Suggestion: {error.suggestion}</p>}
          </>
      )
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
          <CardDescription className="text-center flex items-center justify-center gap-2">
            {metadata.device_type === 'mobile' ? <Smartphone className="h-4 w-4" /> : <Laptop className="h-4 w-4" />}
            {metadata.city && metadata.country ? `${metadata.city}, ${metadata.country}` : 'Please fill out the survey below.'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              <div className="space-y-3 p-4 border rounded-lg bg-background">
                  <Label htmlFor="user-name">Your Name</Label>
                  <div className="flex items-center gap-4">
                    <div className="relative flex-1">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                      <Input 
                        id="user-name" 
                        placeholder="John Doe" 
                        value={userName} 
                        onChange={(e) => setUserName(e.target.value)} 
                        disabled={isAnonymous}
                        className="pl-9"
                        required={!isAnonymous}
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 pt-2">
                      <Checkbox id="anonymous" checked={isAnonymous} onCheckedChange={(checked) => setIsAnonymous(!!checked)} />
                      <Label htmlFor="anonymous" className="flex items-center gap-2 text-sm text-muted-foreground">
                        <VenetianMask className="h-4 w-4" />
                        Submit Anonymously
                      </Label>
                  </div>
              </div>
             <AnimatePresence>
              {survey.questions.map((question, index) => (
                 <motion.div
                    key={question.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    >
                        <div className="space-y-3">
                        <Label htmlFor={`answer-${question.id}`} className="text-base">
                            {index + 1}. {question.text}
                        </Label>
                        {renderInput(question)}
                        {index < survey.questions.length - 1 && <Separator className="mt-6" />}
                        </div>
                 </motion.div>
              ))}
              </AnimatePresence>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row gap-2">
                 <Button type="button" className="w-full" size="lg" variant="outline" onClick={handleValidate} disabled={isValidating}>
                    {isValidating ? <Loader2 className="mr-2 animate-spin" /> : <ShieldCheck className="mr-2"/>}
                    {isValidating ? 'Validating...' : 'Validate Answers'}
                 </Button>
                 <Button type="submit" className="w-full" size="lg" disabled={!isSubmitEnabled || isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 animate-spin" /> : <Send className="mr-2"/>}
                    {isSubmitting ? 'Submitting...' : 'Submit Survey'}
                </Button>
            </CardFooter>
        </form>
      </Card>
    </div>
  );
}
