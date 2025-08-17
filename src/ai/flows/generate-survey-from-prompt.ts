// This file is machine-generated - edit with care!

'use server';

/**
 * @fileOverview AI-powered survey generation from user prompts.
 *
 * - generateSurvey - A function that generates a survey based on a user prompt.
 * - GenerateSurveyInput - The input type for the generateSurvey function.
 * - GenerateSurveyOutput - The return type for the generateSurvey function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateSurveyInputSchema = z.object({
  prompt: z.string().describe('A description of the type of survey to generate.'),
  userInstructions: z.string().optional().describe('Additional instructions from the user.'),
  exampleInputs: z.string().optional().describe('Example inputs to guide survey generation.'),
  questionBankContent: z.string().optional().describe('Content from a question bank to integrate.'),
});
export type GenerateSurveyInput = z.infer<typeof GenerateSurveyInputSchema>;

const GenerateSurveyOutputSchema = z.object({
  surveyQuestions: z.array(z.string()).describe('An array of survey questions generated from the prompt.'),
});
export type GenerateSurveyOutput = z.infer<typeof GenerateSurveyOutputSchema>;

export async function generateSurvey(input: GenerateSurveyInput): Promise<GenerateSurveyOutput> {
  return generateSurveyFlow(input);
}

const generateSurveyPrompt = ai.definePrompt({
  name: 'generateSurveyPrompt',
  input: {schema: GenerateSurveyInputSchema},
  output: {schema: GenerateSurveyOutputSchema},
  prompt: `You are an AI-powered survey generator. Based on the user's prompt, you will generate a list of survey questions.

Prompt: {{{prompt}}}

{{#if userInstructions}}
User Instructions: {{{userInstructions}}}
{{/if}}

{{#if exampleInputs}}
Example Inputs: {{{exampleInputs}}}
{{/if}}

{{#if questionBankContent}}
Question Bank Content: {{{questionBankContent}}}
{{/if}}

Ensure the survey questions are relevant to the prompt and take into account any user instructions, example inputs, or question bank content provided. Return the survey questions as an array of strings.
`,
});

const generateSurveyFlow = ai.defineFlow(
  {
    name: 'generateSurveyFlow',
    inputSchema: GenerateSurveyInputSchema,
    outputSchema: GenerateSurveyOutputSchema,
  },
  async input => {
    const {output} = await generateSurveyPrompt(input);
    return output!;
  }
);
