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
  answer: z.string().describe("The user's answer to the question."),
  context: z.string().optional().describe('Optional context about the survey (e.g., "This survey is for residents of India.")'),
  expected_answers: z.string().optional().describe('A comma-separated list of expected or valid answers. If the user answer is on this list, it is valid.')
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
  // AI-powered validation is now the primary method.
  return validateAnswerFlow(input);
}

const validateAnswerPrompt = ai.definePrompt({
  name: 'validateAnswerPrompt',
  input: { schema: ValidateAnswerInputSchema },
  output: { schema: ValidateAnswerOutputSchema },
  prompt: `You are an AI assistant that validates survey answers. Your task is to determine if the user's answer is a valid and relevant response to the given question.

{{#if context}}
Important Context: {{{context}}}
Use this context to inform your validation. For example, if the context is "This survey is for residents of India", then "Delhi" is a valid answer for a question about states/territories.
{{/if}}

Question: {{{question}}}
Answer: {{{answer}}}

{{#if expected_answers}}
The survey creator provided a list of example answers. Use this as a strong guide for what constitutes a valid answer. The user's answer MUST belong to the same category as these examples. For example, if the expected answers are "water, tea, soda", the category is "beverages". An answer of "lemon" would be invalid because it is a fruit, not a beverage. An answer of "lemonade" would be valid.
Expected Answer Examples: {{{expected_answers}}}
{{/if}}

Evaluate the answer. If it is a reasonable and on-topic response to the question, set 'isValid' to true. If the answer is irrelevant, nonsensical, or clearly not what the question is asking for (especially considering the Expected Answer Examples), set 'isValid' to false.

If the answer is invalid, provide a concise and helpful suggestion for the user on what a good answer might look like. For example, if the question is "What is your favorite color?" and the answer is "Tokyo", a good suggestion would be "Please enter a color, like 'blue' or 'green'."

Do not be overly strict on subjectivity. For example, for "What is your favorite movie?", "The Room" is a valid answer. However, "A car" is not a valid answer.
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
