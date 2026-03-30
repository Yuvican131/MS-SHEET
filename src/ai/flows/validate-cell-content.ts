'use server';

/**
 * @fileOverview This file defines a Genkit flow for validating cell content based on user-defined rules using AI.
 *
 * - validateCellContent - A function that handles the cell content validation process.
 * - ValidateCellContentInput - The input type for the validateCellContent function.
 * - ValidateCellContentOutput - The return type for the validateCellContent function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ValidateCellContentInputSchema = z.object({
  cellContent: z.string().describe('The content of the cell to validate.'),
  validationRules: z.string().describe('The user-defined rules for validation.'),
  commonlyUsedAccountNames: z.string().describe('A comma separated list of commonly used account names'),
});
export type ValidateCellContentInput = z.infer<typeof ValidateCellContentInputSchema>;

const ValidateCellContentOutputSchema = z.object({
  isValid: z.boolean().describe('Whether the cell content is valid according to the rules.'),
  recommendation: z.string().describe('A recommendation for the cell content if it is invalid.'),
});
export type ValidateCellContentOutput = z.infer<typeof ValidateCellContentOutputSchema>;

export async function validateCellContent(input: ValidateCellContentInput): Promise<ValidateCellContentOutput> {
  try {
    return await validateCellContentFlow(input);
  } catch (error: any) {
    // If AI fails (e.g. missing API key or rate limit), we gracefully allow the entry
    console.warn("AI Validation unavailable:", error.message);
    return { isValid: true, recommendation: "" };
  }
}

const prompt = ai.definePrompt({
  name: 'validateCellContentPrompt',
  input: {schema: ValidateCellContentInputSchema},
  output: {schema: ValidateCellContentOutputSchema},
  prompt: `You are an AI assistant that validates cell contents based on user-defined rules.

You will receive the cell content, the validation rules, and a list of commonly used account names.

Your task is to determine if the cell content is valid according to the rules.
If the cell content is invalid, provide a recommendation for the cell content.

Cell Content: {{{cellContent}}}
Validation Rules: {{{validationRules}}}
Commonly Used Account Names: {{{commonlyUsedAccountNames}}}

Consider if the cell content might be a commonly used account name.

Return a JSON object with the following format:
{
  "isValid": boolean,
  "recommendation": string
}
`,
});

const validateCellContentFlow = ai.defineFlow(
  {
    name: 'validateCellContentFlow',
    inputSchema: ValidateCellContentInputSchema,
    outputSchema: ValidateCellContentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
