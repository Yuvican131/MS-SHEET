
'use server';

/**
 * @fileOverview An AI flow for parsing a grid sheet image.
 *
 * - parseGridImage - A function that extracts grid numbers and amounts from an image.
 * - ParseGridImageInput - The input type for the parseGridImage function.
 * - ParseGridImageOutput - The return type for the parseGridImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ParseGridImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a grid sheet, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ParseGridImageInput = z.infer<typeof ParseGridImageInputSchema>;

const ParseGridImageOutputSchema = z.object({
  gridData: z.record(z.string(), z.number()).describe('A mapping of 2-digit cell numbers to their numeric amounts.'),
});
export type ParseGridImageOutput = z.infer<typeof ParseGridImageOutputSchema>;

export async function parseGridImage(input: ParseGridImageInput): Promise<ParseGridImageOutput> {
  try {
    return await parseGridImageFlow(input);
  } catch (error: any) {
    console.error("AI Image Parsing error:", error);
    
    const errMsg = error.message || "";
    if (errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("429")) {
      throw new Error("AI Rate Limit reached. Please wait a minute and try again.");
    }
    if (errMsg.includes("API key not valid")) {
      throw new Error("Invalid API Key. Please verify your GEMINI_API_KEY.");
    }
    throw new Error("Failed to parse image. Please ensure your photo is clear and try again.");
  }
}

const prompt = ai.definePrompt({
  name: 'parseGridImagePrompt',
  input: {schema: ParseGridImageInputSchema},
  output: {schema: ParseGridImageOutputSchema},
  prompt: `You are an expert OCR system specialized in reading "Jantri" or grid-based number sheets.

Your task:
1. Analyze the image which contains a 10x10 grid of 100 boxes (00 to 99).
2. Inside each box, there is a small printed 2-digit number (the identifier) and possibly a larger handwritten or typed number (the amount).
3. Identify every box that has an amount written in it. 
4. For example, if box "14" has "1000" written inside it, you must record that.
5. Extract all such pairs and return them as a JSON object where:
   - The key is the 2-digit identifier (e.g., "00", "01", "99").
   - The value is the numeric amount (e.g., 1000, 500).

Ignore any empty boxes. Only include boxes where an amount is clearly visible.

Photo: {{media url=photoDataUri}}`,
});

const parseGridImageFlow = ai.defineFlow(
  {
    name: 'parseGridImageFlow',
    inputSchema: ParseGridImageInputSchema,
    outputSchema: ParseGridImageOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
