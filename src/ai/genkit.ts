
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

/**
 * Genkit initialization with support for multiple API key environment variables.
 * Using Gemini 1.5 Flash for better stability and reliability on free tiers.
 */
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: apiKey || 'MISSING_API_KEY'
    })
  ],
  model: 'googleai/gemini-1.5-flash',
});
