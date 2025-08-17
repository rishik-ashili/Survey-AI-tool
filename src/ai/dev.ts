import { config } from 'dotenv';
config();

import '@/ai/flows/generate-survey-from-prompt.ts';
import '@/ai/flows/enrich-survey-from-question-bank.ts';
import '@/ai/flows/validate-answer-flow.ts';
