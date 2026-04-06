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
        
        SPECIAL JANTRI TERMINOLOGY:
        1. "Munda" (मुंडा) refers to numbers 01 to 09.
           - "Munda ek" -> 01
           - "Munda do" -> 02
           - ... up to "Munda nau" -> 09
           - "Munda das" -> 10
        2. "Jodda" (जोड़ा) or "Sabhi Jodde" (सभी जोड़े) refers to the set of all pairs: 11, 22, 33, 44, 55, 66, 77, 88, 99, 00.
        
        Rules for Output:
        - If someone says "Munda panch pe 100", output: "05=100"
        - If someone says "Jodda pe 200" or "Saare jodde do sau", output: "11=200 22=200 33=200 44=200 55=200 66=200 77=200 88=200 99=200 00=200"
        - Format the output strictly as "number=amount" pairs separated by spaces.
        - Ignore general conversation, greetings, or filler words.
        - Only return the parsed numeric entries.
        
        Audio Transcription Task:
        Format: number=amount number=amount ...`},
      ],
    });
    
    return {text: text || ""};
  }
);
