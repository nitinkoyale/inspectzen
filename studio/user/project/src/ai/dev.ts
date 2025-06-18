
import { config } from 'dotenv';
config(); // Ensures .env variables are loaded

import '@/ai/flows/suggest-inspection-status.ts';
import '@/ai/flows/generate-progress-report-image-flow.ts';

// Any other Genkit development-specific initializations can go here.
// For example, if you want to start a flow server for local testing:
// import { startFlowsServer } from 'genkit/dev';
// startFlowsServer();
