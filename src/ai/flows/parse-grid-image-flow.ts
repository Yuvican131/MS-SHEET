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
  return parseGridImageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'parseGridImagePrompt',
  input: {schema: ParseGridImageInputSchema},
  output: {schema: ParseGridImageOutputSchema},
  prompt: `You are an expert OCR system specializing in reading grid-based number sheets. 
Your task is to analyze the provided image of a grid and extract all numbers that have an associated amount.

The grid typically contains numbers from 00 to 99. 
Each cell may contain a large number (the cell identifier, e.g., 01, 10, 55) and a smaller number below it (the amount).

Identify every cell that has a value/amount entered.
Return a JSON object where the keys are the 2-digit cell numbers (formatted as strings like "01", "00", "99") and the values are the numeric amounts.

Only include cells that actually have an amount.

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
