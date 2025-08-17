import { config } from 'dotenv';
config();

import '@/ai/flows/generate-survey-from-prompt.ts';
import '@/ai/flows/enrich-survey-from-question-bank.ts';