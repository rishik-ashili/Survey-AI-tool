"use client";

import type { SurveyQuestion } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type SurveyPreviewProps = {
  title: string;
  questions: SurveyQuestion[];
};

export default function SurveyPreview({ title, questions }: SurveyPreviewProps) {
  return (
    <div className="space-y-6">
       <div className="flex-1">
          <h2 className="text-2xl font-bold tracking-tight">Real-Time Preview</h2>
          <p className="text-muted-foreground">
            See how your survey will look to respondents.
          </p>
        </div>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {questions.map((question, index) => (
            <div key={question.id} className="space-y-3 animate-fade-in" style={{ animationDelay: `${index * 100}ms`}}>
              <Label htmlFor={`preview-${question.id}`} className="text-base">
                {index + 1}. {question.text}
              </Label>
              <Input
                id={`preview-${question.id}`}
                disabled
                placeholder="Respondent's answer will go here"
              />
              {index < questions.length - 1 && <Separator className="mt-6" />}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
