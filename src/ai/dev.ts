import { config } from 'dotenv';
config();

import '@/ai/flows/validate-cell-content.ts';
import '@/ai/flows/suggest-account-names.ts';
import '@/ai/flows/transcribe-audio-flow.ts';
import '@/ai/flows/process-order-flow.ts';

