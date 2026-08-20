import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { processApplicationAnalysis } from './src/server/api.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT) || 3000;
app.use(express.json({ limit: '25mb' }));
app.post('/api/analyze', async (req, res) => {
    try {
        const result = await processApplicationAnalysis(req.body);
        res.json(result);
    }
    catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({
            error: error.message || 'Unable to generate this application. Please try again.',
        });
    }
});
// Serve production static assets from dist
app.use(express.static(path.join(__dirname, 'dist')));
// SPA fallback to dist/index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});
app.listen(PORT, '0.0.0.0', () => {
    console.log(`ApplySmart server running on http://0.0.0.0:${PORT}`);
});
