import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

// We use a dummy key if none is provided to prevent the FAILED_PRECONDITION 
// error during module initialization. Runtime errors are caught in the flows.
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY || 'MISSING_API_KEY';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: apiKey
    })
  ],
  model: 'googleai/gemini-2.0-flash',
});
