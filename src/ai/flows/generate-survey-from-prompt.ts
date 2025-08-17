
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
  numberOfQuestions: z.number().optional().default(5).describe('The number of questions to generate.'),
  existingQuestions: z.array(z.string()).optional().describe('An array of existing questions to avoid duplicating.'),
});
export type GenerateSurveyInput = z.infer<typeof GenerateSurveyInputSchema>;

const GenerateSurveyOutputSchema = z.object({
  surveyQuestions: z.array(z.object({
    text: z.string().describe("The text of the survey question."),
    type: z.enum(['text', 'number', 'yes-no', 'multiple-choice']).describe("The type of question. Use 'text' for open-ended answers, 'number' for numeric answers (like ratings or scales), 'yes-no' for binary choices, and 'multiple-choice' for questions where the user can select from a list of options."),
    options: z.array(z.object({ text: z.string() })).optional().describe("An array of option objects for 'multiple-choice' questions."),
  })).describe('An array of survey questions generated from the prompt, each with a text and a type.'),
});
export type GenerateSurveyOutput = z.infer<typeof GenerateSurveyOutputSchema>;

export async function generateSurvey(input: GenerateSurveyInput): Promise<GenerateSurveyOutput> {
  return generateSurveyFlow(input);
}

const generateSurveyPrompt = ai.definePrompt({
  name: 'generateSurveyPrompt',
  input: {schema: GenerateSurveyInputSchema},
  output: {schema: GenerateSurveyOutputSchema},
  prompt: `You are an AI-powered survey generator. Based on the user's prompt, you will generate a list of survey questions. For each question, determine the most appropriate type: 'text' for open-ended answers, 'number' for scales or ratings, 'yes-no' for binary questions, or 'multiple-choice' for questions with a predefined set of answers. Provide a good mix of question types.

For 'multiple-choice' questions, you MUST provide an 'options' array with at least 3 relevant options, each being an object with a 'text' field. For other question types, the 'options' field should be omitted.

Prompt: {{{prompt}}}

Generate exactly {{{numberOfQuestions}}} survey questions.

{{#if userInstructions}}
User Instructions: {{{userInstructions}}}
{{/if}}

{{#if exampleInputs}}
Example Inputs: {{{exampleInputs}}}
{{/if}}

{{#if questionBankContent}}
Question Bank Content: {{{questionBankContent}}}
{{/if}}

{{#if existingQuestions}}
Do not generate questions that are similar to these existing questions:
{{#each existingQuestions}}
- {{{this}}}
{{/each}}
{{/if}}

Ensure the survey questions are relevant to the prompt and take into account any user instructions, example inputs, or question bank content provided. Return the survey questions as an array of objects, where each object has a "text", a "type" field, and an optional "options" field for multiple-choice questions.
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
