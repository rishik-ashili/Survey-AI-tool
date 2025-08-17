"use client";

import { useState } from 'react';
import type { SavedSurvey } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send, Minus, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Input } from './ui/input';

type AttemptSurveyProps = {
  survey: SavedSurvey;
  onBack: () => void;
};

export default function AttemptSurvey({ survey, onBack }: AttemptSurveyProps) {
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const handleAnswerChange = (questionId: string, value: string | number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.keys(answers).length < survey.questions.length) {
         toast({
            variant: "destructive",
            title: "Incomplete Survey",
            description: "Please answer all questions before submitting.",
        });
        return;
    }
    console.log("Survey Submitted:", { surveyId: survey.id, answers });
    setSubmitted(true);
    toast({
        title: "Survey Submitted!",
        description: "Thank you for your feedback.",
    });
  };
  
  const renderInput = (question: SavedSurvey['questions'][0]) => {
      const value = answers[question.id];

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
                          className="text-center"
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
                        className="flex gap-4"
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
          case 'text':
          default:
              return (
                   <Textarea
                        id={`answer-${question.id}`}
                        placeholder="Your answer..."
                        value={value as string || ''}
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                        required
                        className="min-h-[100px]"
                    />
              )
      }
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
          <CardDescription className="text-center">Please fill out the survey below.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
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
            <CardFooter>
                 <Button type="submit" className="w-full" size="lg">
                    <Send className="mr-2"/>
                    Submit Survey
                </Button>
            </CardFooter>
        </form>
      </Card>
    </div>
  );
}
