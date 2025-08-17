
'use server';

/**
 * @fileOverview AI-powered survey generation from user prompts, with support for complex conditional and iterative structures.
 *
 * - generateSurvey - A function that generates a survey based on a user prompt.
 * - GenerateSurveyInput - The input type for the generateSurvey function.
 * - GenerateSurveyOutput - The return type for the generateSurvey function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SubQuestionSchema = z.object({
    text: z.string().describe("The text of the sub-question."),
    type: z.enum(['text', 'number', 'yes-no', 'multiple-choice', 'multiple-choice-multi']).describe("The type of the sub-question."),
    options: z.array(z.object({ text: z.string() })).optional().describe("Options for multiple-choice sub-questions."),
    trigger_condition_value: z.string().describe("The answer from the parent question that triggers this sub-question (e.g., 'Yes', or a specific multiple-choice option text).")
});

const SurveyQuestionSchema = z.object({
  text: z.string().describe("The text of the survey question."),
  type: z.enum(['text', 'number', 'yes-no', 'multiple-choice', 'multiple-choice-multi']).describe("The type of question. Use 'text' for open-ended answers, 'number' for numeric answers (like ratings or scales), 'yes-no' for binary choices, 'multiple-choice' for single selection, and 'multiple-choice-multi' for multiple selections."),
  options: z.array(z.object({ text: z.string() })).optional().describe("An array of option objects for 'multiple-choice' or 'multiple-choice-multi' questions. Required for these types."),
  sub_questions: z.array(SubQuestionSchema).optional().describe("An array of sub-questions that are asked based on the answer to this question. Only generate for 'detailed' surveys."),
  is_iterative: z.boolean().optional().describe("Set to true if this question should be asked multiple times based on the answer to a preceding numeric question (e.g., asking for the name of each child). Only generate for 'iterative' surveys."),
  iterative_source_question_text: z.string().optional().describe("The text of the question that determines the number of iterations (e.g., 'How many children do you have?'). This source question MUST be generated as a separate, preceding question in the survey."),
});


const GenerateSurveyInputSchema = z.object({
  prompt: z.string().describe('A description of the type of survey to generate.'),
  numberOfQuestions: z.number().optional().default(5).describe('The number of questions to generate.'),
  existingQuestions: z.array(z.string()).optional().describe('An array of existing questions to avoid duplicating.'),
  userInstructions: z.string().optional().describe('Additional instructions from the user.'),
  exampleInputs: z.string().optional().describe('Example inputs to guide survey generation.'),
  questionBankContent: z.string().optional().describe('Content from a question bank to integrate.'),
  generateDetailedSurvey: z.boolean().optional().default(false).describe("If true, generate conditional sub-questions for some of the main questions."),
  generateIterativeSurvey: z.boolean().optional().default(false).describe("If true, structure the survey for iterative questions where appropriate (e.g., questions about each family member)."),
});
export type GenerateSurveyInput = z.infer<typeof GenerateSurveyInputSchema>;

const GenerateSurveyOutputSchema = z.object({
  surveyQuestions: z.array(SurveyQuestionSchema).describe('An array of survey questions, potentially with nested sub-questions and iterative properties.'),
});
export type GenerateSurveyOutput = z.infer<typeof GenerateSurveyOutputSchema>;

export async function generateSurvey(input: GenerateSurveyInput): Promise<GenerateSurveyOutput> {
  return generateSurveyFlow(input);
}

const generateSurveyPrompt = ai.definePrompt({
  name: 'generateSurveyPrompt',
  input: {schema: GenerateSurveyInputSchema},
  output: {schema: GenerateSurveyOutputSchema},
  prompt: `You are an AI-powered survey design expert. Based on the user's prompt, generate a list of survey questions.

  Prompt: {{{prompt}}}

  Generate exactly {{{numberOfQuestions}}} main survey questions.

  Adhere to the following structural guidelines:
  - For each question, determine the most appropriate type: 'text', 'number', 'yes-no', 'multiple-choice', or 'multiple-choice-multi'.
  - For 'multiple-choice' and 'multiple-choice-multi' questions, you MUST provide an 'options' array with at least 3 relevant options.
  
  {{#if generateDetailedSurvey}}
  **Detailed Survey Mode**: For some questions (especially 'yes-no' or 'multiple-choice'), generate 1-2 logical follow-up 'sub_questions'. Each sub-question must have a 'trigger_condition_value' that exactly matches the parent question's answer that should trigger it (e.g., 'Yes', or the text of a specific multiple-choice option).
  {{/if}}

  {{#if generateIterativeSurvey}}
  **Iterative Survey Mode**: Identify opportunities for iterative questioning. For example, if you ask "How many children do you have?", a follow-up question might be "What is the name of each child?".
  - To do this, mark the follow-up question with \`"is_iterative": true\`.
  - The question that sets the number of loops (e.g., "How many children do you have?") should be a separate, top-level question that comes BEFORE the iterative question.
  - The iterative question MUST have an 'iterative_source_question_text' field containing the exact text of the question that determines the loop count.
  - An iterative question should be simple, asking about a single attribute (e.g., "Enter the name for each child.").
  {{/if}}

  {{#if userInstructions}}
  User Instructions: {{{userInstructions}}}
  {{/if}}

  {{#if existingQuestions}}
  Do not generate questions that are similar to these existing questions:
  {{#each existingQuestions}}
  - {{{this}}}
  {{/each}}
  {{/if}}

  Return the survey as an array of question objects.
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
