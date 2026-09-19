// Vercel serverless function entry point.
// Vercel automatically deploys any file under /api as its own serverless
// function and parses JSON request bodies for you (req.body is already an object).
import { processApplicationAnalysis } from '../src/server/api.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const result = await processApplicationAnalysis(req.body);
    res.status(200).json(result);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      error: error.message || 'Unable to generate this application. Please try again.',
    });
  }
}
