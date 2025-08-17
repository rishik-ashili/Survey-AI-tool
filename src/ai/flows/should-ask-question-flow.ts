
'use server';

/**
 * @fileOverview An AI flow to determine if a question should be asked based on previous answers.
 *
 * - shouldAskQuestion - A function that decides if a question is relevant.
 * - ShouldAskQuestionInput - The input type for the shouldAskQuestion function.
 * - ShouldAskQuestionOutput - The return type for the shouldAskQuestion function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AnswerHistorySchema = z.object({
  question: z.string().describe('A previously asked question.'),
  answer: z.string().describe('The user\'s answer to that question.'),
});

const ShouldAskQuestionInputSchema = z.object({
  question: z.string().describe('The question that is about to be asked.'),
  previousAnswers: z
    .array(AnswerHistorySchema)
    .describe('A history of questions and their corresponding answers from the user so far.'),
});
export type ShouldAskQuestionInput = z.infer<
  typeof ShouldAskQuestionInputSchema
>;

const ShouldAskQuestionOutputSchema = z.object({
  shouldAsk: z
    .boolean()
    .describe(
      'Whether the question should be asked. Set to false if the question is made irrelevant by previous answers.'
    ),
  reason: z
    .string()
    .describe(
      'A brief explanation for why the question should be skipped. Empty if shouldAsk is true.'
    ),
});
export type ShouldAskQuestionOutput = z.infer<
  typeof ShouldAskQuestionOutputSchema
>;

export async function shouldAskQuestion(
  input: ShouldAskQuestionInput
): Promise<ShouldAskQuestionOutput> {
  // If there are no previous answers, we should always ask the first question.
  if (input.previousAnswers.length === 0) {
    return { shouldAsk: true, reason: '' };
  }
  return shouldAskQuestionFlow(input);
}

const shouldAskQuestionPrompt = ai.definePrompt({
  name: 'shouldAskQuestionPrompt',
  input: { schema: ShouldAskQuestionInputSchema },
  output: { schema: ShouldAskQuestionOutputSchema },
  prompt: `You are a survey logic expert. Your task is to determine if a follow-up question is relevant based on the user's previous answers.

  Here is the history of answers so far:
  {{#each previousAnswers}}
  - Question: "{{question}}"
  - Answer: "{{answer}}"
  {{/each}}

  Based on this history, should the following question be asked?
  Next Question: {{{question}}}

  Analyze the answers. If any previous answer makes the "Next Question" logically irrelevant, redundant, or nonsensical, then you must set 'shouldAsk' to false.

  Examples of when to skip a question (set shouldAsk to false):
  - If a user says their marital status is "Single", a question like "How many children do you have?" might be irrelevant and should be skipped.
  - If a user says "No" to "Do you own a car?", a question like "What is the model of your car?" must be skipped.
  - If a user says they have 0 years of experience in a field, a question about their previous role in that field should be skipped.

  If the question is still relevant or its relevance is ambiguous, set 'shouldAsk' to true.
`,
});

const shouldAskQuestionFlow = ai.defineFlow(
  {
    name: 'shouldAskQuestionFlow',
    inputSchema: ShouldAskQuestionInputSchema,
    outputSchema: ShouldAskQuestionOutputSchema,
  },
  async (input) => {
    const { output } = await shouldAskQuestionPrompt(input);
    return output!;
  }
);
