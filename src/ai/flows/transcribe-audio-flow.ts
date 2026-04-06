'use server';
/**
 * @fileOverview A flow for transcribing audio and extracting game entries.
 *
 * - transcribeAudio - A function that transcribes audio and focuses on Jantri entries.
 * - TranscribeAudioInput - The input type for the transcribeAudio function.
 * - TranscribeAudioOutput - The return type for the transcribeAudio function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import wav from 'wav';

const TranscribeAudioInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "A recording as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type TranscribeAudioInput = z.infer<typeof TranscribeAudioInputSchema>;

const TranscribeAudioOutputSchema = z.object({
  text: z.string().describe('The transcribed text formatted for easy parsing.'),
});
export type TranscribeAudioOutput = z.infer<typeof TranscribeAudioOutputSchema>;

export async function transcribeAudio(
  input: TranscribeAudioInput
): Promise<TranscribeAudioOutput> {
  try {
    return await transcribeAudioFlow(input);
  } catch (error: any) {
    console.error("Transcription failed:", error);
    return { text: "" };
  }
}

async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 44100,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    let bufs = [] as any[];
    writer.on('error', reject);
    writer.on('data', function (d) {
      bufs.push(d);
    });
    writer.on('end', function () {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
}

const transcribeAudioFlow = ai.defineFlow(
  {
    name: 'transcribeAudioFlow',
    inputSchema: TranscribeAudioInputSchema,
    outputSchema: TranscribeAudioOutputSchema,
  },
  async (input) => {
    // Basic transcription using Gemini 1.5 Flash
    const {text} = await ai.generate({
      prompt: [
        {media: {url: input.audioDataUri}},
        {text: `You are an expert transcriber for a Jantri (numbers game). 
        Listen to the audio which contains a user calling in numbers and their amounts.
        
        SPECIAL JANTRI TERMINOLOGY AND MAPPINGS:
        1. "Munda" (मुंडा) mapping:
           - "Munda ek" or "Munda 1" -> 01
           - "Munda do" or "Munda 2" -> 02
           - "Munda teen" or "Munda 3" -> 03
           - "Munda char" or "Munda 4" -> 04
           - "Munda panch" or "Munda 5" -> 05
           - "Munda che" or "Munda 6" -> 06
           - "Munda sath" or "Munda 7" -> 07
           - "Munda ath" or "Munda 8" -> 08
           - "Munda nau" or "Munda 9" -> 09
           - "Munda das" or "Munda 10" -> 10

        2. "Jodda" (जोड़ा) / "Sabhi Jodde" (सभी जोड़े) mapping:
           - This refers to ALL the following numbers: 11, 22, 33, 44, 55, 66, 77, 88, 99, 00.
           - If user says "Jodde pe 200", you must output 200 for each of those 10 numbers.

        3. Standard Numbers:
           - Any other numbers mentioned (e.g., "Bawan", "Chath", "Assi") should be converted to their 2-digit numeric form.

        OUTPUT FORMAT RULES:
        - Output MUST be strictly in the format: "number=amount"
        - Separate multiple entries with a single space.
        - Example: If user says "Munda panch pe 100 aur jodde pe 200", output: "05=100 11=200 22=200 33=200 44=200 55=200 66=200 77=200 88=200 99=200 00=200"
        - Do NOT include any text, headers, or explanations. Only the number=amount pairs.
        
        Transcription Task:
        Process the audio and output the entries now.`},
      ],
    });
    
    return {text: text || ""};
  }
);
