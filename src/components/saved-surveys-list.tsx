
"use client";

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { PlayCircle, Trash2, FileText, ChevronDown, Loader2, BarChart2 } from 'lucide-react';
import { getSavedSurveys, deleteSurvey } from '@/app/actions';
import type { SavedSurvey } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import AttemptSurvey from '@/components/attempt-survey';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import SurveyResults from './survey-results';


export default function SavedSurveysList() {
  const [surveys, setSurveys] = useState<SavedSurvey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [attemptingSurvey, setAttemptingSurvey] = useState<SavedSurvey | null>(null);
  const [viewingResults, setViewingResults] = useState<SavedSurvey | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchSurveys();
  }, []);

  const fetchSurveys = async () => {
    setIsLoading(true);
    const { data, error } = await getSavedSurveys();
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not fetch saved surveys.",
      });
    } else if (data) {
      setSurveys(data);
    }
    setIsLoading(false);
  }

  const handleDelete = async (id: string) => {
    const { error } = await deleteSurvey(id);
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not delete survey.",
      });
    } else {
      setSurveys(surveys.filter((s) => s.id !== id));
      toast({
        title: "Success",
        description: "Survey deleted.",
      });
    }
  };
  
  if (attemptingSurvey) {
    return <AttemptSurvey survey={attemptingSurvey} onBack={() => {
      setAttemptingSurvey(null)
      fetchSurveys();
    }} />;
  }

  if (viewingResults) {
    return <SurveyResults survey={viewingResults} onBack={() => setViewingResults(null)} />;
  }


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Saved Surveys</h2>
          <p className="text-muted-foreground">
            Here are the surveys you've saved. You can attempt them or view their results.
          </p>
        </div>
         <Button onClick={fetchSurveys} variant="outline" size="sm" disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
            <Loader2 className="w-12 h-12 text-muted-foreground/50 animate-spin" />
        </div>
      ) : surveys.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
            <FileText className="w-16 h-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-xl font-semibold">No Saved Surveys Yet</h3>
            <p className="text-muted-foreground mt-2">
              Once you save a survey from the 'Builder' tab, it will appear here.
            </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {surveys.map((survey) => (
            <Collapsible key={survey.id} defaultOpen={false}>
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{survey.title}</CardTitle>
                    <CardDescription>
                      Saved {formatDistanceToNow(new Date(survey.created_at), { addSuffix: true })} &bull; {survey.questions.length} questions
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                     <Button variant="ghost" size="icon" onClick={() => setAttemptingSurvey(survey)}>
                        <PlayCircle />
                        <span className="sr-only">Attempt Survey</span>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setViewingResults(survey)}>
                        <BarChart2 />
                        <span className="sr-only">View Results</span>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                          <Trash2 />
                           <span className="sr-only">Delete Survey</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete this
                            survey and all of its responses.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(survey.id)}>
                            Continue
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <ChevronDown className="h-4 w-4" />
                            <span className="sr-only">Toggle Preview</span>
                        </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent>
                    <div className="space-y-2 mt-2">
                       {survey.questions.map((q,i) => (
                           <div key={q.id} className="text-sm p-2 rounded-md bg-muted/50">
                               {i+1}. {q.text}
                           </div>
                       ))}
                    </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
            </Collapsible>
          ))}
        </div>
      )}
    </div>
  );
}
