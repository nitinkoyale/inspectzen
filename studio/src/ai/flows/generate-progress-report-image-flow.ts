
'use server';
/**
 * @fileOverview A Genkit flow to generate a progress report image.
 *
 * - generateProgressReportImage - A function that generates an image summarizing inspection progress.
 * - ProgressReportImageInput - The input type for the flow.
 * - ProgressReportImageOutput - The return type for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PartProgressSchema = z.object({
  name: z.string().describe('Name of the part.'),
  target: z.number().describe('Target quantity for the part.'),
  inspected: z.number().describe('Total quantity inspected for the part.'),
  ok: z.number().describe('Total quantity OK for the part.'),
});

const ProgressReportImageInputSchema = z.object({
  partsProgress: z.array(PartProgressSchema).describe('An array of progress data for each part.'),
  reportDate: z.string().describe('The date for which the report is generated, e.g., YYYY-MM-DD.'),
});
export type ProgressReportImageInput = z.infer<typeof ProgressReportImageInputSchema>;

const ProgressReportImageOutputSchema = z.object({
  imageDataUri: z.string().describe("The generated progress report image as a data URI. Expected format: 'data:image/png;base64,<encoded_data>'."),
  imagePrompt: z.string().describe('The prompt used to generate the image.'),
});
export type ProgressReportImageOutput = z.infer<typeof ProgressReportImageOutputSchema>;

export async function generateProgressReportImage(input: ProgressReportImageInput): Promise<ProgressReportImageOutput> {
  return generateProgressReportImageFlow(input);
}

const generatePrompt = (input: ProgressReportImageInput): string => {
  let promptText = `Create a visually appealing summary image for a VINFAST daily inspection report dated ${input.reportDate}. The image should represent overall progress. `;
  promptText += "Include distinct sections or visual cues for the following parts: ";
  input.partsProgress.forEach(part => {
    const progressPercentage = part.target > 0 ? Math.round((part.ok / part.target) * 100) : 0;
    promptText += `${part.name} (Target: ${part.target}, OK: ${part.ok}, ${progressPercentage}% complete). `;
  });
  promptText += "Use a clean, professional style suitable for a manufacturing report. Use green indicators for good progress (e.g., >80% of target met), yellow for moderate (e.g., 50-80%), and red for behind (<50%). The image should be clear and easy to understand at a glance. Focus on a graphical representation like status bars or iconic progress indicators rather than detailed text numbers within the image itself, but ensure part names are subtly identifiable if possible.";
  return promptText;
};

const generateProgressReportImageFlow = ai.defineFlow(
  {
    name: 'generateProgressReportImageFlow',
    inputSchema: ProgressReportImageInputSchema,
    outputSchema: ProgressReportImageOutputSchema,
  },
  async (input) => {
    const imagePrompt = generatePrompt(input);
    
    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-exp', // Ensure this model is available and configured
      prompt: imagePrompt,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        // Lower safety settings if needed, but be mindful of content policies
        safetySettings: [
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        ],
      },
    });

    if (!media || !media.url) {
      throw new Error('Image generation failed or returned no media URL.');
    }

    return {
      imageDataUri: media.url, // This should be a data URI from Gemini
      imagePrompt: imagePrompt,
    };
  }
);

