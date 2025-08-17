'use server';

/**
 * @fileOverview An AI flow to validate a survey answer based on the question.
 *
 * - validateAnswer - A function that validates if an answer is relevant to a question.
 * - ValidateAnswerInput - The input type for the validateAnswer function.
 * - ValidateAnswerOutput - The return type for the validateAnswer function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ValidateAnswerInputSchema = z.object({
  question: z.string().describe('The survey question text.'),
  answer: z.string().describe('The user\'s answer to the question.'),
});
export type ValidateAnswerInput = z.infer<typeof ValidateAnswerInputSchema>;

const ValidateAnswerOutputSchema = z.object({
  isValid: z
    .boolean()
    .describe('Whether the answer is valid and relevant to the question.'),
  suggestion: z
    .string()
    .describe(
      'A helpful suggestion for the user if the answer is invalid. For example, "Enter a type of food like \'pizza\' or \'sushi\'."'
    ),
});
export type ValidateAnswerOutput = z.infer<typeof ValidateAnswerOutputSchema>;

export async function validateAnswer(
  input: ValidateAnswerInput
): Promise<ValidateAnswerOutput> {
  return validateAnswerFlow(input);
}

const validateAnswerPrompt = ai.definePrompt({
  name: 'validateAnswerPrompt',
  input: { schema: ValidateAnswerInputSchema },
  output: { schema: ValidateAnswerOutputSchema },
  prompt: `You are an AI assistant that validates survey answers. Your task is to determine if the user's answer is a valid and relevant response to the given question.

Question: {{{question}}}
Answer: {{{answer}}}

Evaluate the answer. If it is a reasonable and on-topic response to the question, set 'isValid' to true. If the answer is irrelevant, nonsensical, or clearly not what the question is asking for, set 'isValid' to false.

If the answer is invalid, provide a concise and helpful suggestion for the user on what a good answer might look like. For example, if the question is "What is your favorite color?" and the answer is "Tokyo", a good suggestion would be "Please enter a color, like 'blue' or 'green'."

Do not be overly strict. A subjective answer is still a valid answer. For example, for "What is your favorite movie?", "The Room" is a valid answer even if it's a bad movie. However, "A car" is not a valid answer.
`,
});

const validateAnswerFlow = ai.defineFlow(
  {
    name: 'validateAnswerFlow',
    inputSchema: ValidateAnswerInputSchema,
    outputSchema: ValidateAnswerOutputSchema,
  },
  async (input) => {
    const { output } = await validateAnswerPrompt(input);
    return output!;
  }
);
