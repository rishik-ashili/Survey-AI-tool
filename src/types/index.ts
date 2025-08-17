
export type QuestionType = 'text' | 'number' | 'yes-no';

export interface SurveyQuestion {
  id: string;
  text: string;
  type: QuestionType;
}

export interface SavedSurvey {
  id: string;
  title: string;
  questions: SurveyQuestion[];
  createdAt: string;
}
