
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


async function insertQuestions(supabase: any, questions: SurveyQuestion[], surveyId: string, parentQuestionDbId?: string, questionMap: Map<string, string> = new Map()) {

    for (const q of questions) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { sub_questions, options, id, ...questionToInsert } = q;

        // Find the DB ID for the iterative source question if it exists
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
        if(id) { // The temporary client-side ID
            questionMap.set(id, newQuestionDbId); 
        }


        // Insert options for multiple-choice questions into the separate `question_options` table
        if ((q.type === 'multiple-choice' || q.type === 'multiple-choice-multi') && options) {
            const optionsToInsert = options.map(opt => ({
                question_id: newQuestionDbId,
                text: opt.text,
            }));
            if (optionsToInsert.length > 0) {
                const { error: optionsError } = await supabase.from('question_options').insert(optionsToInsert);
                if (optionsError) {
                    console.error("Error saving question options:", optionsError);
                    // Rollback the question we just inserted
                    await supabase.from('questions').delete().match({ id: newQuestionDbId });
                    throw new Error(optionsError.message);
                }
            }
        }

        // Recursively insert sub_questions
        if (sub_questions && sub_questions.length > 0) {
            await insertQuestions(supabase, sub_questions, surveyId, newQuestionDbId, questionMap);
        }
    }
    return questionMap;
}


export async function saveSurvey(title: string, questions: SurveyQuestion[]): Promise<{data: SavedSurvey | null, error: string | null}> {
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

  // 2. Recursively insert questions and their sub-questions
  try {
      const idToTextMap = new Map<string, string>();
      const buildIdToTextMap = (qs: SurveyQuestion[]) => {
          for (const q of qs) {
              idToTextMap.set(q.id, q.text);
              if (q.sub_questions) {
                  buildIdToTextMap(q.sub_questions);
              }
          }
      };
      buildIdToTextMap(questions);
      
      const mapQuestionsForSave = (qs: SurveyQuestion[]): any[] => {
          return qs.map(q => {
              const { id, ...rest } = q;
              const newQ: any = {...rest, id};

              if (rest.is_iterative && rest.iterative_source_question_id) {
                  newQ.iterative_source_question_text = idToTextMap.get(rest.iterative_source_question_id);
              }

              if (rest.sub_questions) {
                  newQ.sub_questions = mapQuestionsForSave(rest.sub_questions);
              }
              
              if (rest.options) {
                  newQ.options = rest.options.map((opt: any) => ({ text: opt.text }));
              }
              return newQ;
          });
      };
      const finalQuestions = mapQuestionsForSave(questions);
      await insertQuestions(supabase, finalQuestions, surveyData.id);
  } catch (error: any) {
    console.error("Rolling back survey creation due to error:", error);
    await supabase.from('surveys').delete().match({ id: surveyData.id }); // Rollback survey
    return { data: null, error: error.message };
  }


  // Fetch the full survey data back with questions and options
   const { data: fullSurveyData, error: fetchError } = await getSurveyById(surveyData.id);
   if (fetchError) {
       return { data: null, error: fetchError };
   }

  return { data: fullSurveyData, error: null };
}

// Helper function to recursively build the question tree
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
            id,
            title,
            created_at
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching surveys:", error);
        return { data: null, error: error.message };
    }
    
    // Fetch questions separately to build the tree structure for each survey
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
    answers: Record<string, any>, // Can now be complex with iterations
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

    const answersToInsert: { submission_id: string; question_id: string; value: string; iteration?: number }[] = [];

    Object.entries(answers).forEach(([questionId, answerData]) => {
        if (answerData && typeof answerData === 'object' && answerData.isIterative) {
            (answerData.values as any[]).forEach((value, index) => {
                answersToInsert.push({
                    submission_id: submissionData.id,
                    question_id: questionId,
                    value: String(value),
                    iteration: index + 1,
                });
            });
        } else {
             answersToInsert.push({
                submission_id: submissionData.id,
                question_id: questionId,
                value: Array.isArray(answerData) ? JSON.stringify(answerData) : String(answerData),
            });
        }
    });


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
