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
  message: z.string().describe('The raw text message from the client.'),
  clientPhoneNumber: z.string().describe('The phone number of the client who sent the message.'),
});
export type ProcessOrderInput = z.infer<typeof ProcessOrderInputSchema>;

const OrderDetailSchema = z.object({
  number: z.string().describe('The 2-digit number to play.'),
  amount: z.number().describe('The amount to play for this number.'),
});

const ProcessOrderOutputSchema = z.object({
  draw: z.string().describe('The draw name extracted from the message (e.g., FB, GB, DD).'),
  orders: z.array(OrderDetailSchema).describe('An array of the numbers and amounts to play.'),
  clientPhoneNumber: z.string().describe('The phone number of the client for confirmation.'),
});
export type ProcessOrderOutput = z.infer<typeof ProcessOrderOutputSchema>;

export async function processOrder(
  input: ProcessOrderInput
): Promise<ProcessOrderOutput> {
  try {
    return await processOrderFlow(input);
  } catch (error: any) {
    console.warn("AI Order Processing unavailable:", error);
    // Return a structured empty response if AI fails
    return {
      draw: "",
      orders: [],
      clientPhoneNumber: input.clientPhoneNumber
    };
  }
}

const prompt = ai.definePrompt({
  name: 'processOrderPrompt',
  input: {schema: ProcessOrderInputSchema},
  output: {schema: ProcessOrderOutputSchema},
  prompt: `You are an expert order processing system for a numbers game. You will receive a raw text message and the sender's phone number. Your task is to parse the message to extract the game draw, the numbers to play, and the amount for each number.

The draw names are: DD, ML, FB, GB, GL, DS.

The message may be in a natural language format. Extract all numbers and their corresponding amounts. If an amount applies to multiple numbers, create a separate order for each.

Message: {{{message}}}
Client Phone Number: {{{clientPhoneNumber}}}

Analyze the message and return a JSON object with the extracted draw, a list of orders, and the client's phone number.
`,
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
