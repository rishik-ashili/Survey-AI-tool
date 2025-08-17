"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Sparkles, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  prompt: z.string().min(10, {
    message: "Prompt must be at least 10 characters.",
  }),
  userInstructions: z.string().optional(),
  exampleInputs: z.string().optional(),
  questionBank: z.any().optional(),
});

type SurveyGeneratorFormProps = {
  onGenerateSurvey: (data: {
    prompt: string;
    userInstructions: string;
    exampleInputs: string;
    questionBankContent: string;
  }) => void;
  isLoading: boolean;
};

const toneButtons = [
    { label: "Professional", value: "Keep the tone professional and corporate." },
    { label: "Government", value: "Use formal language suitable for government surveys." },
    { label: "Creative", value: "Use a creative and engaging tone." },
    { label: "Casual", value: "Use a casual and friendly tone." },
]

export default function SurveyGeneratorForm({
  onGenerateSurvey,
  isLoading,
}: SurveyGeneratorFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: "",
      userInstructions: "",
      exampleInputs: "",
    },
  });

  const questionBankRef = form.register("questionBank");

  async function onSubmit(values: z.infer<typeof formSchema>) {
    let questionBankContent = "";
    if (values.questionBank && values.questionBank.length > 0) {
      const file = values.questionBank[0];
      if (file.type === "text/csv" || file.type === "text/plain") {
        questionBankContent = await file.text();
      } else {
        form.setError("questionBank", {
          type: "manual",
          message: "Please upload a valid .csv or .txt file.",
        });
        return;
      }
    }

    onGenerateSurvey({ ...values, questionBankContent });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="prompt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Survey Prompt</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="e.g., A customer satisfaction survey for a new SaaS product"
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Describe the survey you want to create.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="userInstructions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Additional Instructions (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="e.g., Focus on ease of use and pricing."
                  {...field}
                />
              </FormControl>
              <div className="flex flex-wrap gap-2 mt-2">
                {toneButtons.map(tone => (
                    <Button key={tone.label} type="button" variant="outline" size="sm" onClick={() => form.setValue('userInstructions', tone.value)}>
                        {tone.label}
                    </Button>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="exampleInputs"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Example Questions (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="e.g., 'How would you rate the user interface?'"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="questionBank"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Question Bank (Optional)</FormLabel>
              <FormControl>
                <div className="relative">
                  <Upload className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="file"
                    accept=".csv, .txt"
                    className="pl-9"
                    {...questionBankRef}
                  />
                </div>
              </FormControl>
              <FormDescription>
                Upload a .csv or .txt file with one question per line.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading} className="w-full" size="lg">
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles />
              Generate Survey
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
