
'use server';

/**
 * @fileOverview An AI flow to generate personalized questions based on survey answers.
 *
 * - generatePersonalizedQuestions - Generates personalized follow-up questions.
 * - GeneratePersonalizedQuestionsInput - Input for the flow.
 * - GeneratePersonalizedQuestionsOutput - Output from the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const AnswerSchema = z.object({
  question: z.string().describe('The original survey question.'),
  answer: z.string().describe('The answer the user gave.'),
});

const GeneratePersonalizedQuestionsInputSchema = z.object({
  answers: z.array(AnswerSchema).describe("A list of the user's answers to the main survey."),
});
export type GeneratePersonalizedQuestionsInput = z.infer<typeof GeneratePersonalizedQuestionsInputSchema>;

const PersonalizedQuestionSchema = z.object({
  questionText: z.string().describe("The text of the personalized, open-ended follow-up question."),
});

const GeneratePersonalizedQuestionsOutputSchema = z.object({
  questions: z
    .array(PersonalizedQuestionSchema)
    .describe('An array of 2-3 personalized questions for the user.'),
});
export type GeneratePersonalizedQuestionsOutput = z.infer<typeof GeneratePersonalizedQuestionsOutputSchema>;


export async function generatePersonalizedQuestions(
  input: GeneratePersonalizedQuestionsInput
): Promise<GeneratePersonalizedQuestionsOutput> {
  return generatePersonalizedQuestionsFlow(input);
}


const generatePersonalizedQuestionsPrompt = ai.definePrompt({
  name: 'generatePersonalizedQuestionsPrompt',
  input: { schema: GeneratePersonalizedQuestionsInputSchema },
  output: { schema: GeneratePersonalizedQuestionsOutputSchema },
  prompt: `You are a survey assistant who excels at creating engaging, personalized follow-up questions.
Based on the user's answers to a survey, your task is to generate 2 or 3 open-ended questions to learn more about their experiences.

The questions should be:
- Directly related to the answers provided.
- Open-ended, encouraging a thoughtful response.
- Friendly and conversational in tone.

Here are the user's answers:
{{#each answers}}
- Question: "{{question}}"
- User's Answer: "{{answer}}"
{{/each}}

Generate a new, short list of personalized follow-up questions based on these answers.
`,
});

const generatePersonalizedQuestionsFlow = ai.defineFlow(
  {
    name: 'generatePersonalizedQuestionsFlow',
    inputSchema: GeneratePersonalizedQuestionsInputSchema,
    outputSchema: GeneratePersonalizedQuestionsOutputSchema,
  },
  async (input) => {
    // If there are no answers, return no questions.
    if (input.answers.length === 0) {
      return { questions: [] };
    }
    const { output } = await generatePersonalizedQuestionsPrompt(input);
    return output!;
  }
);
