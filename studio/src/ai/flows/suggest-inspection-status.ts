// use server'
'use server';
/**
 * @fileOverview AI-powered tool status suggestion flow.
 *
 * - suggestInspectionStatus - A function that suggests the most probable inspection status based on historical data patterns.
 * - SuggestInspectionStatusInput - The input type for the suggestInspectionStatus function.
 * - SuggestInspectionStatusOutput - The return type for the suggestInspectionStatus function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestInspectionStatusInputSchema = z.object({
  partName: z.string().describe('The name of the part being inspected (e.g., Lay shaft assy, Main reduction gear, Input shaft).'),
  section: z.string().describe('The inspection section (e.g., Material Inspection, Final Inspection, TPI Inspection, Dispatch).'),
  subsection: z.string().describe('The specific subsection within the inspection section (e.g., Washing pending, Multigauge pending, Multigauge inspection, Visual inspection, RFD, Dispatch).'),
  historicalData: z.string().describe('Historical inspection data patterns as a JSON string.'),
});
export type SuggestInspectionStatusInput = z.infer<typeof SuggestInspectionStatusInputSchema>;

const SuggestInspectionStatusOutputSchema = z.object({
  suggestedStatus: z.string().describe('The suggested inspection status based on historical data.'),
  confidenceLevel: z.number().describe('A numerical value between 0 and 1 indicating the confidence level of the suggestion.'),
  rationale: z.string().describe('Explanation of why the AI suggested this status based on the provided data.'),
});
export type SuggestInspectionStatusOutput = z.infer<typeof SuggestInspectionStatusOutputSchema>;

export async function suggestInspectionStatus(input: SuggestInspectionStatusInput): Promise<SuggestInspectionStatusOutput> {
  return suggestInspectionStatusFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestInspectionStatusPrompt',
  input: {schema: SuggestInspectionStatusInputSchema},
  output: {schema: SuggestInspectionStatusOutputSchema},
  prompt: `You are an AI assistant designed to analyze historical inspection data and suggest the most probable inspection status.

  Part Name: {{{partName}}}
  Section: {{{section}}}
  Subsection: {{{subsection}}}
  Historical Data: {{{historicalData}}}

  Based on the historical data provided, suggest the most probable inspection status, along with a confidence level (0 to 1) and a brief rationale.
  Format the output as JSON. 
  `, 
});

const suggestInspectionStatusFlow = ai.defineFlow(
  {
    name: 'suggestInspectionStatusFlow',
    inputSchema: SuggestInspectionStatusInputSchema,
    outputSchema: SuggestInspectionStatusOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
