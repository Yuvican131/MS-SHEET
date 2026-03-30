
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
    // Standardize error reporting for client consumption
    if (error.message?.includes("RESOURCE_EXHAUSTED") || error.message?.includes("429")) {
      throw new Error("AI Rate Limit reached. Please wait a minute and try again.");
    }
    if (error.message?.includes("API key not valid")) {
      throw new Error("Invalid API Key. Please verify your GEMINI_API_KEY.");
    }
    throw new Error(error.message || "Failed to parse image. Please ensure your API key is configured.");
  }
}

const prompt = ai.definePrompt({
  name: 'parseGridImagePrompt',
  input: {schema: ParseGridImageInputSchema},
  output: {schema: ParseGridImageOutputSchema},
  prompt: `You are an expert OCR system specialized in reading jantri/grid-based number sheets. 

Your task:
1. Analyze the image which contains a grid of 100 boxes (from 00 to 99).
2. Each box has a small 2-digit identifier at the top-left or top (e.g., "01", "11", "55").
3. Some boxes have a large number written inside them (the amount). In the provided image, many cells show "1000".
4. Extract every cell that has an amount written inside it.
5. Return a JSON object where the keys are the 2-digit cell identifiers (always as 2-digit strings like "01", "00", "99") and the values are the numeric amounts found inside those specific boxes.

Ignore any empty cells. Only include cells that clearly have an amount written in them.

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
