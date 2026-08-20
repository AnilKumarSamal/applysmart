import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { processApplicationAnalysis } from './src/server/api.js';
function apiPlugin() {
    return {
        name: 'api-server-plugin',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                if (req.url === '/api/analyze' && req.method === 'POST') {
                    try {
                        let body = '';
                        req.on('data', (chunk) => {
                            body += chunk;
                        });
                        req.on('end', async () => {
                            try {
                                const payload = JSON.parse(body);
                                const result = await processApplicationAnalysis(payload);
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify(result));
                            }
                            catch (error) {
                                console.error('Analysis error:', error);
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({
                                    error: error.message || 'Unable to generate this application. Please try again.',
                                }));
                            }
                        });
                    }
                    catch (err) {
                        console.error('Request processing error:', err);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: err.message || 'Server error' }));
                    }
                    return;
                }
                next();
            });
        },
    };
}
export default defineConfig(() => {
    return {
        plugins: [react(), tailwindcss(), apiPlugin()],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, '.'),
            },
        },
        server: {
            // HMR is disabled in AI Studio via DISABLE_HMR env var.
            hmr: process.env.DISABLE_HMR !== 'true',
            watch: process.env.DISABLE_HMR === 'true' ? null : {},
        },
    };
});
