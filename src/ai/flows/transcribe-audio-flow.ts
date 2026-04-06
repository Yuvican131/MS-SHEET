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
        {text: `You are an expert transcriber for a numbers game. 
        Listen to the audio which contains a user calling in numbers and their amounts.
        
        Examples of what you might hear:
        - "01 pe 100, 05 pe 500" -> Output: "01=100 05=500"
        - "दस नंबर पे पांच सौ" (Number 10 for 500) -> Output: "10=500"
        - "double zero thousand" -> Output: "00=1000"
        
        Focus strictly on the numbers and amounts. Format the output as "number=amount" pairs separated by spaces.
        If there is general talk, ignore it. Only return the parsed entries.`},
      ],
    });
    
    return {text: text || ""};
  }
);
