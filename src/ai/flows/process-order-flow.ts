'use server';

/**
 * @fileOverview An AI flow for processing a client's order from a raw text message.
 *
 * - processOrder - A function that parses a text message to extract order details.
 * - ProcessOrderInput - The input type for the processOrder function.
 * - ProcessOrderOutput - The return type for the processOrder function.
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
    throw new Error("Could not parse order message.");
  }
}

const prompt = ai.definePrompt({
  name: 'processOrderPrompt',
  input: {schema: ProcessOrderInputSchema},
  output: {schema: ProcessOrderOutputSchema},
  prompt: `You are an expert Jantri order parser. Extract game entries from raw text messages.

Draw Names: FB, GB, GL, DS, DD, ML.

Common Formats:
- "FB 01=100 05=500" -> Draw: FB, Orders: {01: 100, 05: 500}
- "Gali mein munda ek 100" -> Draw: GL, Orders: {01: 100}
- "Jodda 50" -> All pairs (11, 22, ..., 00) for 50 each.

Output only valid 2-digit number strings (e.g., "01", "00", "99").

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