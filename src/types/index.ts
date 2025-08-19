

export type QuestionType = 'text' | 'number' | 'yes-no' | 'multiple-choice' | 'multiple-choice-multi';

export interface QuestionOption {
  id: string;
  text: string;
  question_id?: string;
}

// Web Speech API declarations
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export interface SurveyQuestion {
  id: string; // This will be a UUID from Supabase
  text: string;
  type: QuestionType;
  options?: QuestionOption[]; // For multiple-choice questions
  expected_answers?: string; // For text questions, comma-separated
  created_at?: string; // from Supabase
  survey_id?: string; // from Supabase
  min_range?: number;
  max_range?: number;

  // New properties for advanced surveys
  parent_question_id?: string | null;
  trigger_condition_value?: string | null;
  sub_questions?: SurveyQuestion[]; // For frontend nesting

  is_iterative?: boolean;
  iterative_source_question_id?: string | null; // The ID of the question that determines the number of loops (e.g., "How many children?")
  iterative_source_question_text?: string | null; // The text of the source question
}

export interface SavedSurvey {
  id: string; // This will be a UUID from Supabase
  title: string;
  questions: SurveyQuestion[];
  created_at: string; // from Supabase
  has_personalized_questions?: boolean;
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
  iteration?: number; // For iterative questions
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
  parent_question_id?: string | null;
  is_iterative?: boolean;
  iterative_source_question_id?: string | null;
  iterative_source_question_text?: string | null;
  time_taken_seconds?: number | null; // Time taken to answer this question
  question_started_at?: string | null; // When the question was first shown
  question_answered_at?: string | null; // When the question was answered
}

export interface PersonalizedAnswer {
  id: string;
  submission_id: string;
  question_text: string;
  answer_text: string;
  created_at: string;
}

export interface SubmissionMetadata {
  latitude?: number;
  longitude?: number;
  city?: string;
  country?: string;
  device_type?: 'mobile' | 'desktop';
}
