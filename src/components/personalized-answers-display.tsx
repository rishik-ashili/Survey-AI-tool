
"use client";

import { useState, useEffect } from 'react';
import { getPersonalizedAnswers } from '@/app/actions';
import type { PersonalizedAnswer } from '@/types';
import { Separator } from './ui/separator';
import { Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type PersonalizedAnswersDisplayProps = {
  submissionId: string;
};

export default function PersonalizedAnswersDisplay({ submissionId }: PersonalizedAnswersDisplayProps) {
  const [answers, setAnswers] = useState<PersonalizedAnswer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAnswers = async () => {
      setIsLoading(true);
      const { data, error } = await getPersonalizedAnswers(submissionId);
      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not fetch personalized answers for this submission.",
        });
      } else {
        setAnswers(data || []);
      }
      setIsLoading(false);
    };

    fetchAnswers();
  }, [submissionId, toast]);

  if (isLoading) {
    return (
      <div className="mt-4 flex items-center justify-center p-4">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        <span className="text-muted-foreground">Loading personalized answers...</span>
      </div>
    );
  }

  if (answers.length === 0) {
    return null; // Don't render anything if there are no answers
  }

  return (
    <>
      <Separator className="my-4" />
      <div className="space-y-4">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Personalized Follow-up
        </h4>
        <ul className="space-y-4">
          {answers.map((ans) => (
            <li key={ans.id} className="text-sm">
              <strong className="font-medium">{ans.question_text}</strong>
              <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{ans.answer_text}</p>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
