"use client";

import type { SurveyQuestion } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";

type SurveyPreviewProps = {
  title: string;
  questions: SurveyQuestion[];
};

export default function SurveyPreview({ title, questions }: SurveyPreviewProps) {

  const renderInputPreview = (question: SurveyQuestion) => {
    switch (question.type) {
      case 'number':
        return <Input disabled placeholder="Numeric answer" type="number" />;
      case 'yes-no':
        return (
          <div className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id={`preview-yes-${question.id}`} disabled />
                <Label htmlFor={`preview-yes-${question.id}`}>Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id={`preview-no-${question.id}`} disabled />
                <Label htmlFor={`preview-no-${question.id}`}>No</Label>
              </div>
          </div>
        )
      case 'text':
      default:
        return <Input disabled placeholder="Respondent's answer will go here" />;
    }
  }

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
              {renderInputPreview(question)}
              {index < questions.length - 1 && <Separator className="mt-6" />}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
