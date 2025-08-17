'use server';
/**
 * @fileOverview A Genkit flow that enriches a survey with questions from a question bank.
 *
 * - enrichSurveyFromQuestionBank - A function that enriches a survey with questions from a question bank.
 * - EnrichSurveyFromQuestionBankInput - The input type for the enrichSurveyFromQuestionBank function.
 * - EnrichSurveyFromQuestionBankOutput - The return type for the enrichSurveyFromQuestionBank function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EnrichSurveyFromQuestionBankInputSchema = z.object({
  surveyPrompt: z
    .string()
    .describe('The prompt for generating the base survey.'),
  questionBankContent: z
    .string()
    .describe('The content of the question bank to use for enrichment.'),
  userInstructions: z.string().optional().describe('Optional instructions from the user on how to enrich the survey.'),
  exampleInputs: z.string().optional().describe('Optional example inputs to guide the enrichment process.'),
});
export type EnrichSurveyFromQuestionBankInput = z.infer<
  typeof EnrichSurveyFromQuestionBankInputSchema
>;

const EnrichSurveyFromQuestionBankOutputSchema = z.object({
  enrichedSurvey: z
    .string()
    .describe('The enriched survey content, including questions from the question bank.'),
});
export type EnrichSurveyFromQuestionBankOutput = z.infer<
  typeof EnrichSurveyFromQuestionBankOutputSchema
>;

export async function enrichSurveyFromQuestionBank(
  input: EnrichSurveyFromQuestionBankInput
): Promise<EnrichSurveyFromQuestionBankOutput> {
  return enrichSurveyFromQuestionBankFlow(input);
}

const enrichSurveyPrompt = ai.definePrompt({
  name: 'enrichSurveyPrompt',
  input: {schema: EnrichSurveyFromQuestionBankInputSchema},
  output: {schema: EnrichSurveyFromQuestionBankOutputSchema},
  prompt: `You are an AI survey enrichment expert.  Your goal is to create a comprehensive survey given a base survey and a question bank.

  Instructions: Take the question bank content and incorporate it into the base survey.

  Base Survey Prompt: {{{surveyPrompt}}}

  Question Bank Content: {{{questionBankContent}}}

  User Instructions: {{{userInstructions}}}

  Example Inputs: {{{exampleInputs}}}

  Enriched Survey:`, // Keep newlines for readability.
});

const enrichSurveyFromQuestionBankFlow = ai.defineFlow(
  {
    name: 'enrichSurveyFromQuestionBankFlow',
    inputSchema: EnrichSurveyFromQuestionBankInputSchema,
    outputSchema: EnrichSurveyFromQuestionBankOutputSchema,
  },
  async input => {
    const {output} = await enrichSurveyPrompt(input);
    return output!;
  }
);
