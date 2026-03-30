
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
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ]
  },
  prompt: `You are an expert OCR system specialized in reading "Jantri" style grid sheets.

IMAGE ANALYSIS:
The image contains a 10x10 grid of 100 boxes.
- Each box has a small printed 2-digit number (00 to 99) in a corner or at the top. This is the "identifier".
- Some boxes have a larger handwritten or typed number inside. This is the "amount".

YOUR TASK:
1. Go through every box from 00 to 99.
2. If you see a clearly written amount inside a box, record the 2-digit identifier and that amount.
3. Ignore any boxes that are empty or only contain the small printed identifier.
4. If an amount looks like "1000", record 1000. If it looks like "500", record 500.

OUTPUT FORMAT:
Return a JSON object where the key is the 2-digit identifier (e.g. "01", "14", "99") and the value is the numeric amount.

Example: {"01": 100, "14": 1000, "88": 500}

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
