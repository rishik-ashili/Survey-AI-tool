export interface SurveyQuestion {
  id: string;
  text: string;
}

export interface SavedSurvey {
  id: string;
  title: string;
  questions: SurveyQuestion[];
  createdAt: string;
}
