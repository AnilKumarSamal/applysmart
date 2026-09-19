# ApplySmart

ApplySmart prepares tailored job applications (resume, cover letter, screening
answers, recruiter email) using a React frontend and the Gemini API (free tier).

## Stack

- React + JavaScript
- Vite
- Node.js + Express (local dev / self-hosted) or Vercel Serverless Functions (Vercel deploy)
- Gemini API (`@google/genai`, free-tier models: `gemini-flash-latest` / `gemini-2.5-flash` / `gemini-2.5-flash-lite`)
- Tailwind CSS

## Run locally

1. Install dependencies:
   `npm install`
2. Create `.env.local` (copy `.env.example`) and set your key:
   `GEMINI_API_KEY=your-key-here`
   Get a **free** key at https://aistudio.google.com/apikey (no billing account required).
3. Start the development server:
   `npm run dev`

## Production (self-hosted / any Node host)

Build the frontend:

`npm run build`

Start the Node.js server (serves `dist/` and the `/api/analyze` route via Express):

`npm start`

Make sure `GEMINI_API_KEY` is set in the host's environment.

## Deploying on Vercel

This project is set up to deploy on Vercel as-is:

1. Push this repo to GitHub (or GitLab/Bitbucket).
2. In Vercel, click **Add New → Project** and import the repo.
3. Vercel auto-detects the settings from `vercel.json`:
   - Build command: `npm run build`
   - Output directory: `dist`
   - The file at `api/analyze.js` is deployed automatically as a serverless
     function, so no Express server is needed in production on Vercel.
4. Under **Project Settings → Environment Variables**, add:
   - `GEMINI_API_KEY` = your free Google AI Studio key
5. Deploy. The app calls `/api/analyze`, which Vercel routes straight to
   `api/analyze.js`.

Note: `server.js` (Express) is only used for local/self-hosted production runs
(`npm start`). Vercel ignores it and uses `api/analyze.js` + the static
`dist/` build instead — that's why both exist side by side.

## About the free tier

Google's Gemini API free tier (via Google AI Studio) is not a time-limited
trial — it's an ongoing quota tied to your Google account, roughly 500–1,500
requests/day depending on the model, no credit card required. That's more
than enough for personal use of this app. If you ever outgrow it, the same
`.env.local` key can be upgraded to a paid Google Cloud billing tier without
any code changes.
