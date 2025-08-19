
"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { generateSurvey, type GenerateSurveyInput, type GenerateSurveyOutput } from "@/ai/flows/generate-survey-from-prompt";
import { validateAnswer, type ValidateAnswerInput, type ValidateAnswerOutput } from "@/ai/flows/validate-answer-flow";
import { shouldAskQuestion, type ShouldAskQuestionInput, type ShouldAskQuestionOutput } from "@/ai/flows/should-ask-question-flow";
import { generatePersonalizedQuestions, type GeneratePersonalizedQuestionsInput, type GeneratePersonalizedQuestionsOutput } from "@/ai/flows/generate-personalized-questions-flow";
import { generateSurveyInsights, type SurveyInsightsInput, type SurveyInsightsOutput } from "@/ai/flows/survey-insights-flow";
import type { SavedSurvey, SurveyQuestion, SurveyResult, SubmissionMetadata, PersonalizedAnswer } from "@/types";

export async function handleGenerateSurvey(input: GenerateSurveyInput): Promise<GenerateSurveyOutput> {
    try {
        const output = await generateSurvey(input);
        if (!output || !output.surveyQuestions) {
            console.error("AI flow returned invalid output:", output);
            return { surveyQuestions: [] };
        }
        return output;
    } catch (error) {
        console.error("Error calling generateSurvey flow:", error);
        return { surveyQuestions: [] };
    }
}

export async function handleValidateAnswer(input: ValidateAnswerInput): Promise<ValidateAnswerOutput> {
    try {
        return await validateAnswer(input);
    } catch (error) {
        console.error("Error calling validateAnswer flow:", error);
        // Default to valid to avoid blocking user if AI fails, but log the error.
        return { isValid: true, suggestion: "Could not validate answer. Please try again." };
    }
}

export async function handleShouldAskQuestion(input: ShouldAskQuestionInput): Promise<ShouldAskQuestionOutput> {
    try {
        return await shouldAskQuestion(input);
    } catch (error) {
        console.error("Error calling shouldAskQuestion flow:", error);
        // Default to true to avoid skipping questions if AI fails.
        return { shouldAsk: true, reason: "Could not determine if question should be asked." };
    }
}

export async function handleGeneratePersonalizedQuestions(submissionId: string): Promise<{ data: GeneratePersonalizedQuestionsOutput | null, error: string | null }> {
    console.log('handleGeneratePersonalizedQuestions called with submissionId:', submissionId);

    const cookieStore = cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { get: (name) => cookieStore.get(name)?.value } }
    );

    try {
        // First, get the survey answers for this submission
        console.log('Fetching survey data for submission:', submissionId);
        const { data: surveyData, error: surveyError } = await supabase
            .from('survey_results')
            .select('question_text, answer_value')
            .eq('submission_id', submissionId);

        console.log('Survey data query result:', { surveyData, surveyError });

        if (surveyError) {
            console.error("Error fetching survey data for personalized questions:", surveyError);
            return { data: null, error: surveyError.message };
        }

        if (!surveyData || surveyData.length === 0) {
            console.log('No survey data found for submission:', submissionId);
            return { data: { questions: [] }, error: null };
        }

        // Format the answers for the AI flow
        const formattedAnswers = surveyData.map(item => ({
            question: item.question_text,
            answer: item.answer_value
        }));

        console.log('Formatted answers for AI:', formattedAnswers);

        // Generate personalized questions using AI
        console.log('Calling AI to generate personalized questions...');
        const personalizedQuestions = await generatePersonalizedQuestions({ answers: formattedAnswers });

        console.log('AI generated questions:', personalizedQuestions);

        return { data: personalizedQuestions, error: null };
    } catch (error) {
        console.error("Error generating personalized questions:", error);
        return { data: null, error: "Failed to generate personalized questions" };
    }
}


async function insertQuestions(supabase: any, questions: SurveyQuestion[], surveyId: string, parentQuestionDbId?: string, questionMap: Map<string, string> = new Map()) {

    for (const q of questions) {
        const { sub_questions, options, id, ...questionToInsert } = q;

        const iterativeSourceDbId = q.is_iterative && q.iterative_source_question_id
            ? questionMap.get(q.iterative_source_question_id)
            : null;

        const { data: questionsData, error: questionsError } = await supabase
            .from('questions')
            .insert({
                ...questionToInsert,
                survey_id: surveyId,
                parent_question_id: parentQuestionDbId,
                iterative_source_question_id: iterativeSourceDbId,
            })
            .select()
            .single();

        if (questionsError) {
            console.error("Error saving question:", questionsError);
            throw new Error(questionsError.message);
        }

        const newQuestionDbId = questionsData.id;
        if (id) {
            questionMap.set(id, newQuestionDbId);
        }

        if ((q.type === 'multiple-choice' || q.type === 'multiple-choice-multi' || q.type === 'yes-no') && options) {
            const optionsToInsert = options.map(opt => ({
                question_id: newQuestionDbId,
                text: opt.text,
            }));
            if (optionsToInsert.length > 0) {
                const { error: optionsError } = await supabase.from('question_options').insert(optionsToInsert);
                if (optionsError) {
                    console.error("Error saving question options:", optionsError);
                    await supabase.from('questions').delete().match({ id: newQuestionDbId });
                    throw new Error(optionsError.message);
                }
            }
        }

        if (sub_questions && sub_questions.length > 0) {
            await insertQuestions(supabase, sub_questions, surveyId, newQuestionDbId, questionMap);
        }
    }
    return questionMap;
}


export async function saveSurvey(title: string, questions: SurveyQuestion[], hasPersonalizedQuestions: boolean): Promise<{ data: SavedSurvey | null, error: string | null }> {
    const cookieStore = cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { get: (name) => cookieStore.get(name)?.value } }
    );

    const { data: surveyData, error: surveyError } = await supabase
        .from('surveys')
        .insert({ title, has_personalized_questions: hasPersonalizedQuestions })
        .select()
        .single();

    if (surveyError) {
        console.error("Error saving survey:", surveyError);
        return { data: null, error: surveyError.message };
    }

    try {
        const idToTextMap = new Map<string, string>();
        const buildIdToTextMap = (qs: SurveyQuestion[]) => {
            for (const q of qs) {
                if (q.id) {
                    idToTextMap.set(q.id, q.text);
                }
                if (q.sub_questions) {
                    buildIdToTextMap(q.sub_questions);
                }
            }
        };
        buildIdToTextMap(questions);

        const mapQuestionsForSave = (qs: SurveyQuestion[]): any[] => {
            return qs.map(q => {
                const { id, ...rest } = q;
                const newQ: any = { ...rest };

                if (rest.is_iterative && rest.iterative_source_question_id) {
                    newQ.iterative_source_question_text = idToTextMap.get(rest.iterative_source_question_id) || null;
                }

                if (rest.sub_questions) {
                    newQ.sub_questions = mapQuestionsForSave(rest.sub_questions);
                }

                return { id, ...newQ };
            });
        };
        const finalQuestions = mapQuestionsForSave(questions);
        await insertQuestions(supabase, finalQuestions, surveyData.id);
    } catch (error: any) {
        console.error("Rolling back survey creation due to error:", error);
        await supabase.from('surveys').delete().match({ id: surveyData.id });
        return { data: null, error: error.message };
    }

    const { data: fullSurveyData, error: fetchError } = await getSurveyById(surveyData.id);
    if (fetchError) {
        return { data: null, error: fetchError };
    }

    return { data: fullSurveyData, error: null };
}

const buildQuestionTree = (questionsList: SurveyQuestion[]): SurveyQuestion[] => {
    const questionMap = new Map(questionsList.map(q => [q.id, { ...q, sub_questions: [] }]));
    const rootQuestions: SurveyQuestion[] = [];

    for (const question of questionMap.values()) {
        if (question.parent_question_id && questionMap.has(question.parent_question_id)) {
            questionMap.get(question.parent_question_id)?.sub_questions?.push(question);
        } else {
            rootQuestions.push(question);
        }
    }
    return rootQuestions;
};


export async function getSurveyById(surveyId: string): Promise<{ data: SavedSurvey | null; error: string | null }> {
    const cookieStore = cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { get: (name) => cookieStore.get(name)?.value } }
    );

    const { data, error } = await supabase
        .from('surveys')
        .select(`
            *,
            questions (
                *,
                options:question_options(*)
            )
        `)
        .eq('id', surveyId)
        .order('created_at', { referencedTable: 'questions', ascending: true })
        .single();

    if (error) {
        console.error("Error fetching survey by id:", error);
        return { data: null, error: error.message };
    }

    if (data && data.questions) {
        data.questions = buildQuestionTree(data.questions);
    }

    return { data, error: null };
}


export async function getSavedSurveys(): Promise<{ data: SavedSurvey[] | null, error: string | null }> {
    const cookieStore = cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { get: (name) => cookieStore.get(name)?.value } }
    );

    const { data, error } = await supabase
        .from('surveys')
        .select(`
            id,
            title,
            created_at,
            has_personalized_questions
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching surveys:", error);
        return { data: null, error: error.message };
    }

    const surveysWithQuestions = await Promise.all(data.map(async (survey) => {
        const { data: questionsData, error: questionsError } = await supabase
            .from('questions')
            .select(`
                *,
                options:question_options(*)
            `)
            .eq('survey_id', survey.id)
            .order('created_at', { ascending: true });

        if (questionsError) {
            console.error(`Error fetching questions for survey ${survey.id}:`, questionsError);
            return { ...survey, questions: [] };
        }

        return { ...survey, questions: buildQuestionTree(questionsData || []) };
    }));


    return { data: surveysWithQuestions, error: null };
}

export async function deleteSurvey(id: string): Promise<{ error: string | null }> {
    const cookieStore = cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { get: (name) => cookieStore.get(name)?.value } }
    );

    const { error } = await supabase.from('surveys').delete().match({ id });
    if (error) {
        console.error("Error deleting survey:", error);
        return { error: error.message };
    }

    return { error: null }
}

export async function submitSurvey(
    surveyId: string,
    answers: Record<string, any>,
    userName: string | undefined,
    metadata: SubmissionMetadata,
): Promise<{ submissionId: string | null, error: string | null }> {
    const cookieStore = cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { get: (name) => cookieStore.get(name)?.value } }
    );

    const { data: submissionData, error: submissionError } = await supabase
        .from('submissions')
        .insert({
            survey_id: surveyId,
            user_name: userName,
            ...metadata
        })
        .select()
        .single();

    if (submissionError) {
        console.error("Error creating submission:", submissionError);
        return { submissionId: null, error: submissionError.message };
    }

    if (!submissionData) {
        const errorMessage = "Failed to create submission or retrieve submission ID.";
        console.error(errorMessage);
        return { submissionId: null, error: errorMessage };
    }

    const answersToInsert: {
        submission_id: string;
        question_id: string;
        value: string;
        time_taken_seconds?: number;
        question_started_at?: string;
        question_answered_at?: string;
    }[] = [];

    Object.entries(answers).forEach(([questionId, answerData]) => {
        if (answerData && typeof answerData === 'object' && answerData.isIterative) {
            (answerData.values as any[]).forEach((value) => {
                if (value !== undefined && value !== null) { // Only insert if there's a value
                    answersToInsert.push({
                        submission_id: submissionData.id,
                        question_id: questionId,
                        value: String(value),
                        time_taken_seconds: answerData.timeTakenSeconds,
                        question_started_at: answerData.questionStartedAt,
                        question_answered_at: answerData.questionAnsweredAt,
                    });
                }
            });
        } else if (answerData !== undefined && answerData !== null) {
            const value = answerData.value || answerData.values || answerData;
            answersToInsert.push({
                submission_id: submissionData.id,
                question_id: questionId,
                value: Array.isArray(value) ? JSON.stringify(value) : String(value),
                time_taken_seconds: answerData.timeTakenSeconds,
                question_started_at: answerData.questionStartedAt,
                question_answered_at: answerData.questionAnsweredAt,
            });
        }
    });


    if (answersToInsert.length > 0) {
        const { error: answersError } = await supabase
            .from('answers')
            .insert(answersToInsert);

        if (answersError) {
            console.error("Error saving answers:", answersError);
            await supabase.from('submissions').delete().match({ id: submissionData.id });
            return { submissionId: null, error: answersError.message };
        }
    }


    return { submissionId: submissionData.id, error: null };
}

export async function submitPersonalizedAnswers(
    submissionId: string,
    answers: Record<string, string>
): Promise<{ error: string | null }> {
    const cookieStore = cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { get: (name) => cookieStore.get(name)?.value } }
    );

    const answersToInsert = Object.entries(answers).map(([questionText, answerText]) => ({
        submission_id: submissionId,
        question_text: questionText,
        answer_text: answerText,
    }));

    if (answersToInsert.length === 0) {
        return { error: null }; // Nothing to submit
    }

    const { error } = await supabase.from('personalized_answers').insert(answersToInsert);

    if (error) {
        console.error("Error saving personalized answers:", error);
        return { error: error.message };
    }

    return { error: null };
}


export async function getSurveyResults(surveyId: string): Promise<{ data: SurveyResult[] | null, error: string | null }> {
    const cookieStore = cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { get: (name) => cookieStore.get(name)?.value } }
    );

    const { data, error } = await supabase
        .from('survey_results')
        .select('*')
        .eq('survey_id', surveyId)
        .order('submission_created_at', { ascending: false });

    if (error) {
        console.error("Error fetching survey results:", error);
        return { data: null, error: error.message };
    }

    return { data: data || [], error: null };
}

export async function handleGenerateSurveyInsights(surveyId: string): Promise<{ data: SurveyInsightsOutput | null, error: string | null }> {
    console.log('handleGenerateSurveyInsights called with surveyId:', surveyId);

    const cookieStore = cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { get: (name) => cookieStore.get(name)?.value } }
    );

    try {
        // First, get the survey details
        const { data: surveyData, error: surveyError } = await supabase
            .from('surveys')
            .select('title')
            .eq('id', surveyId)
            .single();

        if (surveyError) {
            console.error("Error fetching survey data:", surveyError);
            return { data: null, error: surveyError.message };
        }

        // Get survey results
        const { data: resultsData, error: resultsError } = await supabase
            .from('survey_results')
            .select('question_text, question_type, answer_value')
            .eq('survey_id', surveyId);

        console.log('Survey results data:', resultsData);

        if (resultsError) {
            console.error("Error fetching survey results:", resultsError);
            return { data: null, error: resultsError.message };
        }

        if (!resultsData || resultsData.length === 0) {
            console.log('No survey results found for survey:', surveyId);
            return {
                data: {
                    summary: "No survey responses have been collected yet.",
                    insights: [],
                    recommendations: ["Increase survey distribution to gather meaningful data."],
                    demographicAnalysis: "No demographic data available.",
                    sentimentAnalysis: "No sentiment data available.",
                },
                error: null
            };
        }

        // Process the results to group by question
        const questionResults = new Map<string, {
            questionText: string;
            questionType: string;
            responses: Map<string, number>;
            totalResponses: number;
        }>();

        resultsData.forEach(result => {
            const key = `${result.question_text}-${result.question_type}`;
            if (!questionResults.has(key)) {
                questionResults.set(key, {
                    questionText: result.question_text,
                    questionType: result.question_type,
                    responses: new Map(),
                    totalResponses: 0
                });
            }

            const questionData = questionResults.get(key)!;
            const answer = result.answer_value;

            questionData.responses.set(answer, (questionData.responses.get(answer) || 0) + 1);
            questionData.totalResponses += 1;
        });

        // Format data for AI
        const formattedQuestionResults = Array.from(questionResults.values()).map(q => ({
            questionText: q.questionText,
            questionType: q.questionType,
            totalResponses: q.totalResponses,
            responses: Array.from(q.responses.entries()).map(([answer, count]) => ({
                answer,
                count,
                percentage: Math.round((count / q.totalResponses) * 100)
            }))
        }));

        const totalSubmissions = new Set(resultsData.map(r => r.submission_id)).size;

        const insightsInput: SurveyInsightsInput = {
            surveyTitle: surveyData.title,
            totalSubmissions,
            questionResults: formattedQuestionResults
        };

        console.log('Formatted insights input:', insightsInput);

        // Generate insights using AI
        console.log('Calling AI to generate survey insights...');
        const surveyInsights = await generateSurveyInsights(insightsInput);

        console.log('AI generated insights:', surveyInsights);

        return { data: surveyInsights, error: null };
    } catch (error) {
        console.error("Error generating survey insights:", error);
        return { data: null, error: "Failed to generate survey insights" };
    }
}

export async function getPersonalizedAnswers(submissionId: string): Promise<{ data: PersonalizedAnswer[] | null, error: string | null }> {
    console.log('getPersonalizedAnswers called with submissionId:', submissionId);

    const cookieStore = cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { get: (name) => cookieStore.get(name)?.value } }
    );

    console.log('Querying personalized_answers for submission_id:', submissionId);
    const { data, error } = await supabase
        .from('personalized_answers')
        .select('*')
        .eq('submission_id', submissionId);

    console.log('Personalized answers query result:', { data, error, count: data?.length });

    if (error) {
        console.error("Error fetching personalized answers:", error);
        return { data: null, error: error.message };
    }

    return { data, error: null };
}
