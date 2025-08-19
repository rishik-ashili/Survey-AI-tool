'use server';

/**
 * @fileOverview An AI flow to generate detailed insights and analysis from survey results.
 *
 * - generateSurveyInsights - Analyzes survey results and provides comprehensive insights.
 * - SurveyInsightsInput - Input for the flow.
 * - SurveyInsightsOutput - Output from the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const QuestionResultSchema = z.object({
    questionText: z.string().describe('The survey question text.'),
    questionType: z.string().describe('The type of question (multiple-choice, yes-no, text, etc.).'),
    totalResponses: z.number().describe('Total number of responses for this question.'),
    responses: z.array(z.object({
        answer: z.string().describe('The answer given.'),
        count: z.number().describe('Number of people who gave this answer.'),
        percentage: z.number().describe('Percentage of total responses.'),
    })).describe('Breakdown of all responses to this question.'),
});

const SurveyInsightsInputSchema = z.object({
    surveyTitle: z.string().describe('The title of the survey.'),
    totalSubmissions: z.number().describe('Total number of survey submissions.'),
    questionResults: z.array(QuestionResultSchema).describe('Results for each question in the survey.'),
});
export type SurveyInsightsInput = z.infer<typeof SurveyInsightsInputSchema>;

const InsightSchema = z.object({
    category: z.string().describe('The category of insight (e.g., Demographics, Preferences, Trends).'),
    title: z.string().describe('A concise title for this insight.'),
    description: z.string().describe('Detailed explanation of the insight.'),
    keyFindings: z.array(z.string()).describe('Key bullet points summarizing the main findings.'),
});

const SurveyInsightsOutputSchema = z.object({
    summary: z.string().describe('Overall summary of the survey results and main themes.'),
    insights: z.array(InsightSchema).describe('Detailed insights categorized by different aspects.'),
    recommendations: z.array(z.string()).describe('Actionable recommendations based on the survey results.'),
    demographicAnalysis: z.string().describe('Analysis of demographic patterns if applicable.'),
    sentimentAnalysis: z.string().describe('Overall sentiment and perception analysis from responses.'),
});
export type SurveyInsightsOutput = z.infer<typeof SurveyInsightsOutputSchema>;

export async function generateSurveyInsights(
    input: SurveyInsightsInput
): Promise<SurveyInsightsOutput> {
    return generateSurveyInsightsFlow(input);
}

const generateSurveyInsightsPrompt = ai.definePrompt({
    name: 'generateSurveyInsightsPrompt',
    input: { schema: SurveyInsightsInputSchema },
    output: { schema: SurveyInsightsOutputSchema },
    prompt: `You are a professional survey analyst and data scientist with expertise in interpreting survey results and providing actionable insights.

Analyze the following survey results and provide comprehensive insights:

Survey: "{{surveyTitle}}"
Total Submissions: {{totalSubmissions}}

Question Results:
{{#each questionResults}}
Question {{@index}}: {{questionText}} ({{questionType}})
Total Responses: {{totalResponses}}
{{#each responses}}
- {{answer}}: {{count}} responses ({{percentage}}%)
{{/each}}

{{/each}}

Your analysis should include:

1. **Overall Summary**: A high-level overview of what the survey reveals about the respondents and their perspectives.

2. **Detailed Insights**: Break down the results into meaningful categories and provide deep analysis of patterns, correlations, and interesting findings.

3. **Demographic Analysis**: If demographic questions are present, analyze how different groups responded and what this reveals.

4. **Sentiment Analysis**: Assess the overall sentiment, satisfaction levels, preferences, and general perception of respondents.

5. **Recommendations**: Provide actionable recommendations based on the findings.

Focus on:
- Identifying trends and patterns across questions
- Highlighting surprising or significant findings
- Explaining what the distribution of answers reveals about the population
- Drawing connections between different questions when relevant
- Providing context for why certain patterns might exist
- Suggesting areas for follow-up or improvement

Be thorough, insightful, and professional in your analysis.`,
});

const generateSurveyInsightsFlow = ai.defineFlow(
    {
        name: 'generateSurveyInsightsFlow',
        inputSchema: SurveyInsightsInputSchema,
        outputSchema: SurveyInsightsOutputSchema,
    },
    async (input) => {
        // If there are no submissions, return empty insights
        if (input.totalSubmissions === 0) {
            return {
                summary: "No survey responses have been collected yet.",
                insights: [],
                recommendations: ["Increase survey distribution to gather meaningful data."],
                demographicAnalysis: "No demographic data available.",
                sentimentAnalysis: "No sentiment data available.",
            };
        }

        const { output } = await generateSurveyInsightsPrompt(input);
        return output!;
    }
);
