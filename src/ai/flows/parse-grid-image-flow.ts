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
  gridData: z.record(z.string(), z.any()).describe('A mapping of 2-digit cell numbers to their numeric amounts.'),
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
    if (errMsg.includes("API key not valid") || errMsg.includes("403")) {
      throw new Error("Invalid API Key. Please verify your GEMINI_API_KEY in the .env file.");
    }
    
    // Fallback error message
    throw new Error("The AI could not read the image. Please ensure the photo is bright, clear, and focused directly on the grid.");
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
      { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
    ]
  },
  prompt: `You are an expert OCR system specialized in reading "Jantri" style numeric grid sheets.

IMAGE ANALYSIS GUIDELINES:
1. The image contains a large grid (usually 10x10) with 100 boxes numbered 01 to 100 (where 100 is often written as 00).
2. Each box has a small, fixed printed number (the cell identifier).
3. Your primary goal is to find boxes that have a LARGER, handwritten, or typed numeric amount written inside them.

TASK:
- Scan every box in the grid from 01 to 00.
- For every box that contains an additional amount, extract that amount.
- Ignore boxes that are empty or only contain their small printed identifier.
- If an amount is ambiguous, use your best judgment based on common values like 10, 20, 50, 100, 500, 1000, 2000, etc.

OUTPUT:
- Return a JSON object where the key is the 2-digit identifier (e.g., "01", "02", ..., "99", "00") and the value is the numeric amount found.

Example Output: {"05": 100, "12": 500, "88": 1000}

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
    
    // Ensure all values are numeric
    const cleanedGridData: Record<string, number> = {};
    if (output && output.gridData) {
      Object.entries(output.gridData).forEach(([key, value]) => {
        const numValue = typeof value === 'number' ? value : parseFloat(String(value));
        if (!isNaN(numValue)) {
          cleanedGridData[key] = numValue;
        }
      });
    }
    
    return { gridData: cleanedGridData };
  }
);
