
"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { generateSurvey, type GenerateSurveyInput, type GenerateSurveyOutput } from "@/ai/flows/generate-survey-from-prompt";
import type { SavedSurvey, SurveyQuestion } from "@/types";

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

export async function saveSurvey(title: string, questions: Omit<SurveyQuestion, 'id'>[]): Promise<{data: SavedSurvey | null, error: string | null}> {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );

  const { data: surveyData, error: surveyError } = await supabase
    .from('surveys')
    .insert({ title })
    .select()
    .single();

  if (surveyError) {
    console.error("Error saving survey:", surveyError);
    return { data: null, error: surveyError.message };
  }

  const questionsToInsert = questions.map(q => ({
    survey_id: surveyData.id,
    text: q.text,
    type: q.type,
  }));

  const { data: questionsData, error: questionsError } = await supabase
    .from('questions')
    .insert(questionsToInsert)
    .select();

  if (questionsError) {
    console.error("Error saving questions:", questionsError);
    // Optional: roll back survey insertion
    await supabase.from('surveys').delete().match({ id: surveyData.id });
    return { data: null, error: questionsError.message };
  }

  return { data: { ...surveyData, questions: questionsData }, error: null };
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
                *
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
    answers: Record<string, string | number>,
    userName?: string
): Promise<{ error: string | null }> {
    const cookieStore = cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { get: (name) => cookieStore.get(name)?.value } }
    );

    const { data: submissionData, error: submissionError } = await supabase
        .from('submissions')
        .insert({ survey_id: surveyId, user_name: userName })
        .select()
        .single();
    
    if (submissionError) {
        console.error("Error creating submission:", submissionError);
        return { error: submissionError.message };
    }

    const answersToInsert = Object.entries(answers).map(([questionId, value]) => ({
        submission_id: submissionData.id,
        question_id: questionId,
        value: String(value),
    }));

    const { error: answersError } = await supabase
        .from('answers')
        .insert(answersToInsert);

    if (answersError) {
        console.error("Error saving answers:", answersError);
        return { error: answersError.message };
    }

    return { error: null };
}
