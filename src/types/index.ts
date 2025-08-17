
export type QuestionType = 'text' | 'number' | 'yes-no' | 'multiple-choice';

export interface QuestionOption {
  id: string;
  text: string;
  question_id?: string;
}

export interface SurveyQuestion {
  id: string; // This will be a UUID from Supabase
  text: string;
  type: QuestionType;
  options?: QuestionOption[]; // For multiple-choice questions
  created_at?: string; // from Supabase
  survey_id?: string; // from Supabase
}

export interface SavedSurvey {
  id: string; // This will be a UUID from Supabase
  title: string;
  questions: SurveyQuestion[];
  created_at: string; // from Supabase
}

// Represents a user's submission for a survey
export interface SurveySubmission {
  id: string;
  survey_id: string;
  user_name?: string; // Optional for anonymous submissions
  created_at: string;
  answers: SubmissionAnswer[];
}

// Represents a single answer within a submission
export interface SubmissionAnswer {
    id: string;
    submission_id: string;
    question_id: string;
    value: string; // Stored as text, parsed based on question type
}

export interface SurveyResult {
    survey_id: string;
    survey_title: string;
    submission_id: string;
    user_name: string | null;
    submission_created_at: string;
    latitude: number | null;
    longitude: number | null;
    city: string | null;
    country: string | null;
    device_type: string | null;
    question_id: string;
    question_text: string;
    question_type: QuestionType;
    answer_value: string;
}

export interface SubmissionMetadata {
    latitude?: number;
    longitude?: number;
    city?: string;
    country?: string;
    device_type?: 'mobile' | 'desktop';
}
