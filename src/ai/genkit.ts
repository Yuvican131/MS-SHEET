import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

/**
 * Genkit initialization with support for multiple API key environment variables.
 * A fallback string is provided to prevent crashes during module evaluation if keys are missing.
 */
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: apiKey || 'MISSING_API_KEY'
    })
  ],
  model: 'googleai/gemini-2.0-flash',
});
