
"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { generateSurvey, type GenerateSurveyInput, type GenerateSurveyOutput } from "@/ai/flows/generate-survey-from-prompt";
import { validateAnswer, type ValidateAnswerInput, type ValidateAnswerOutput } from "@/ai/flows/validate-answer-flow";
import type { SavedSurvey, SurveyQuestion, SurveyResult, SubmissionMetadata } from "@/types";

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


export async function saveSurvey(title: string, questions: Omit<SurveyQuestion, 'id'>[]): Promise<{data: SavedSurvey | null, error: string | null}> {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );

  // 1. Insert the survey
  const { data: surveyData, error: surveyError } = await supabase
    .from('surveys')
    .insert({ title })
    .select()
    .single();

  if (surveyError) {
    console.error("Error saving survey:", surveyError);
    return { data: null, error: surveyError.message };
  }

  // 2. Insert the questions and collect their IDs
  const questionsToInsert = questions.map(q => ({
    survey_id: surveyData.id,
    text: q.text,
    type: q.type,
    expected_answers: q.expected_answers,
    min_range: q.min_range,
    max_range: q.max_range,
  }));
  
  const { data: questionsData, error: questionsError } = await supabase
    .from('questions')
    .insert(questionsToInsert)
    .select();

  if (questionsError) {
    console.error("Error saving questions:", questionsError);
    await supabase.from('surveys').delete().match({ id: surveyData.id }); // Rollback
    return { data: null, error: questionsError.message };
  }

  // 3. Prepare and insert question options for multiple-choice questions
  const optionsToInsert = [];
  for (let i = 0; i < questions.length; i++) {
    const originalQuestion = questions[i];
    const newQuestion = questionsData[i];
    if ((originalQuestion.type === 'multiple-choice' || originalQuestion.type === 'multiple-choice-multi') && originalQuestion.options) {
      for (const option of originalQuestion.options) {
        optionsToInsert.push({
          question_id: newQuestion.id,
          text: option.text,
        });
      }
    }
  }

  if (optionsToInsert.length > 0) {
    const { error: optionsError } = await supabase
      .from('question_options')
      .insert(optionsToInsert);

    if (optionsError) {
      console.error("Error saving question options:", optionsError);
      await supabase.from('surveys').delete().match({ id: surveyData.id }); // Rollback
      return { data: null, error: optionsError.message };
    }
  }

  // Fetch the full survey data back with questions and options
   const { data: fullSurveyData, error: fetchError } = await getSurveyById(surveyData.id);
   if (fetchError) {
       return { data: null, error: fetchError };
   }

  return { data: fullSurveyData, error: null };
}


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
        .single();
    
    if (error) {
        console.error("Error fetching survey by id:", error);
        return { data: null, error: error.message };
    }

    return { data, error: null };
}


export async function getSavedSurveys(): Promise<{data: SavedSurvey[] | null, error: string | null}> {
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
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching surveys:", error);
        return { data: null, error: error.message };
    }
    
    return { data, error: null };
}

export async function deleteSurvey(id: string): Promise<{error: string | null}> {
    const cookieStore = cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { get: (name) => cookieStore.get(name)?.value } }
    );

    const { error } = await supabase.from('surveys').delete().match({ id });
    if(error) {
         console.error("Error deleting survey:", error);
         return { error: error.message };
    }

    return { error: null }
}

export async function submitSurvey(
    surveyId: string,
    answers: Record<string, string | number | string[]>,
    userName: string | undefined,
    metadata: SubmissionMetadata,
): Promise<{ error: string | null }> {
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
        return { error: submissionError.message };
    }
    
    if (!submissionData) {
        const errorMessage = "Failed to create submission or retrieve submission ID.";
        console.error(errorMessage);
        return { error: errorMessage };
    }


    const answersToInsert = Object.entries(answers).map(([questionId, value]) => ({
        submission_id: submissionData.id,
        question_id: questionId,
        value: Array.isArray(value) ? JSON.stringify(value) : String(value),
    }));

    const { error: answersError } = await supabase
        .from('answers')
        .insert(answersToInsert);

    if (answersError) {
        console.error("Error saving answers:", answersError);
        // Rollback the submission if answers fail to save
        await supabase.from('submissions').delete().match({ id: submissionData.id });
        return { error: answersError.message };
    }

    return { error: null };
}

export async function getSurveyResults(surveyId: string): Promise<{data: SurveyResult[] | null, error: string | null}> {
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
    
    return { data, error: null };
}
