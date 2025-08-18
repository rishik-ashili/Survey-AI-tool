
'use server';

/**
 * @fileOverview An AI flow to generate conversational responses during a survey.
 *
 * This flow takes the current question, the user's answer, and validation feedback
 * to generate a natural-sounding response that guides the user through the survey.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const RespondToSurveyAnswerInputSchema = z.object({
  question: z.string().describe('The question that was just asked.'),
  answer: z.string().describe("The user's answer to the question."),
  isAnswerValid: z.boolean().describe('Whether the provided answer was considered valid.'),
  validationSuggestion: z.string().optional().describe('A suggestion for the user if their answer was invalid.'),
  isLastQuestion: z.boolean().describe('Whether this was the last question in the survey.'),
});
export type RespondToSurveyAnswerInput = z.infer<typeof RespondToSurveyAnswerInputSchema>;


const RespondToSurveyAnswerOutputSchema = z.object({
  response: z.string().describe('A friendly, conversational response to the user.'),
});
export type RespondToSurveyAnswerOutput = z.infer<typeof RespondToSurveyAnswerOutputSchema>;

export async function respondToSurveyAnswer(
    input: RespondToSurveyAnswerInput
): Promise<RespondToSurveyAnswerOutput> {
    return respondToSurveyAnswerFlow(input);
}


const respondToSurveyAnswerPrompt = ai.definePrompt({
  name: 'respondToSurveyAnswerPrompt',
  input: { schema: RespondToSurveyAnswerInputSchema },
  output: { schema: RespondToSurveyAnswerOutputSchema },
  prompt: `You are a friendly AI survey assistant. Your goal is to guide a user through a survey in a conversational way.

  Current Question: "{{question}}"
  User's Answer: "{{answer}}"

  {{#if isAnswerValid}}
    The user's answer was valid.
    - Acknowledge their answer briefly and positively.
    - Then, introduce the next question.
    - If this was the last question, thank them and tell them they can now submit the survey.
  {{else}}
    The user's answer was invalid.
    - Gently inform them that their answer isn't quite right.
    - Provide the helpful suggestion: "{{validationSuggestion}}"
    - Re-ask the original question clearly.
  {{/if}}

  {{#if isLastQuestion}}
    This was the last question. Conclude the survey warmly. Thank the user for their time and let them know their answers are ready for final submission.
  {{/if}}

  Keep your response concise, friendly, and helpful.
`,
});


const respondToSurveyAnswerFlow = ai.defineFlow(
  {
    name: 'respondToSurveyAnswerFlow',
    inputSchema: RespondToSurveyAnswerInputSchema,
    outputSchema: RespondToSurveyAnswerOutputSchema,
  },
  async (input) => {
    const { output } = await respondToSurveyAnswerPrompt(input);
    return output!;
  }
);
