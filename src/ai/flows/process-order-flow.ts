'use server';

/**
 * @fileOverview An AI flow for processing a client's order from a raw text message.
 * Optimized for WhatsApp automation and Jantri specific terminology.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ProcessOrderInputSchema = z.object({
  message: z.string().describe('The raw text message from the client (e.g., "FB 01 100, 05 500").'),
  clientPhoneNumber: z.string().describe('The phone number of the client who sent the message.'),
});
export type ProcessOrderInput = z.infer<typeof ProcessOrderInputSchema>;

const OrderDetailSchema = z.object({
  number: z.string().describe('The 2-digit number to play (00-99).'),
  amount: z.number().describe('The amount to play for this number.'),
});

const ProcessOrderOutputSchema = z.object({
  draw: z.string().describe('The draw name (FB, GB, GL, DS, DD, ML).'),
  orders: z.array(OrderDetailSchema).describe('The extracted numbers and amounts.'),
});
export type ProcessOrderOutput = z.infer<typeof ProcessOrderOutputSchema>;

export async function processOrder(
  input: ProcessOrderInput
): Promise<ProcessOrderOutput> {
  try {
    return await processOrderFlow(input);
  } catch (error: any) {
    console.warn("AI Order Processing failed:", error);
    throw new Error("Could not parse order message. Ensure it contains a valid draw name and entries.");
  }
}

const prompt = ai.definePrompt({
  name: 'processOrderPrompt',
  input: {schema: ProcessOrderInputSchema},
  output: {schema: ProcessOrderOutputSchema},
  prompt: `You are an expert Jantri order parser. Your task is to extract game entries from raw WhatsApp messages.

DRAW NAMES: FB, GB, GL, DS, DD, ML.

SPECIAL TERMINOLOGY & MAPPINGS:
1. "Munda" (मुंडा) mapping:
   - "Munda ek" -> 01
   - "Munda do" -> 02
   - "Munda teen" -> 03
   - "Munda char" -> 04
   - "Munda panch" -> 05
   - "Munda che" -> 06
   - "Munda sath" -> 07
   - "Munda ath" -> 08
   - "Munda nau" -> 09
   - "Munda das" -> 10

2. "Jodda" (जोड़ा) / "Sabhi Jodde" (सभी जोड़े):
   - This refers to ALL: 11, 22, 33, 44, 55, 66, 77, 88, 99, 00.
   - Example: "Jodde pe 100" means 100 for each of those 10 numbers.

3. Standard entries:
   - "01=100" -> number: "01", amount: 100
   - "05 500" -> number: "05", amount: 500
   - "Pachaas pe sau" -> number: "50", amount: 100

OUTPUT FORMAT:
- You must identify exactly one draw name.
- You must return an array of {number: string, amount: number} objects.
- All numbers must be 2-digits (e.g., "01", "00", "99").

Message: {{{message}}}
Client Phone: {{{clientPhoneNumber}}}`,
});

const processOrderFlow = ai.defineFlow(
  {
    name: 'processOrderFlow',
    inputSchema: ProcessOrderInputSchema,
    outputSchema: ProcessOrderOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);