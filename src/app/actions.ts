
"use server";

import { generateSurvey, type GenerateSurveyInput, type GenerateSurveyOutput } from "@/ai/flows/generate-survey-from-prompt";

export async function handleGenerateSurvey(input: GenerateSurveyInput): Promise<GenerateSurveyOutput> {
  try {
    const output = await generateSurvey(input);
    if (!output || !output.surveyQuestions) {
      console.error("AI flow returned invalid output:", output);
      return { surveyQuestions: [] };
    }
    return output;
  } catch (error) {
    console.error("Error calling generateSurvey flow:", error);
    // In case of an exception, return a structured error response.
    // Here, we return an empty array to be handled by the client.
    return { surveyQuestions: [] };
  }
}
