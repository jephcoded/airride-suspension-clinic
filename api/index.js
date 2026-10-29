// Vercel serverless entry: the whole Express API runs as one function.
import { createApp } from '../server/dist/app.js';

export default createApp();
