# MediScribe AI

> Giving doctors their time back with AI

## Problem

Doctors spend **2 hours documenting** for every **1 hour spent with patients**. MediScribe AI eliminates that gap.

## Solution

Three AI agents that listen to consultations and generate complete SOAP notes in under 30 seconds:

1. **Transcription Agent** — Converts audio to text using Groq Whisper Large v3
2. **Medical NLP Agent** — Extracts symptoms, medications, allergies, vitals, and red flags using Llama 3.3 70B
3. **SOAP Generator Agent** — Produces a structured, clinically accurate SOAP note with safety flags

## Architecture

```
[Microphone] → [Audio Blob] → Edge Function: transcribe (Groq Whisper)
                                    ↓
                              [Transcript Text]
                                    ↓
                         Edge Function: analyze (Groq Llama 3.3 70B)
                              ├── NLP Agent → Medical Entities
                              └── SOAP Agent → SOAP Note + Safety Flags
                                    ↓
                         Edge Function: save-note → Supabase DB
```

### Agent 1 — Transcription Agent (Groq Whisper Large v3)
- Accepts audio from the browser microphone
- Validates file type (webm, wav, mp3, mpeg, ogg) and size (max 25MB)
- Sends to Groq Whisper API for transcription
- Returns clean transcript text

### Agent 2 — Medical NLP Agent (Llama 3.3 70B Versatile)
- Accepts transcript text (max 10,000 characters)
- Extracts structured medical entities: symptoms, medications, allergies, duration, vital signs, diagnosis, red flags
- Returns validated JSON

### Agent 3 — SOAP Generator + Safety Agent (Llama 3.3 70B Versatile)
- Accepts transcript + extracted entities
- Generates a complete SOAP note (Subjective, Objective, Assessment, Plan)
- Extracts safety flags separately for prominent display

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), Tailwind CSS, shadcn/ui |
| Backend | Supabase Edge Functions (Deno/TypeScript) |
| Database | Supabase (PostgreSQL with RLS) |
| AI | Groq API (llama-3.3-70b-versatile + whisper-large-v3) |
| Animations | Framer Motion |

## Local Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Fill in your Groq API key and Supabase credentials.

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000` in your browser.

## Environment Variables

See `.env.example` for all required variables. **Never commit real keys to GitHub.**

| Variable | Description |
|----------|-------------|
| `GROQ_API_KEY` | Groq API key for Whisper + Llama models |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (frontend-safe) |

## Security

- **No hardcoded secrets** — all API keys in environment variables only
- **Rate limiting** on all backend endpoints (transcribe: 10/min, analyze: 10/min, save: 20/min, notes: 30/min)
- **File validation** — type and size checks on audio uploads
- **Input sanitization** — HTML stripping and length validation on all inputs
- **Row Level Security** enabled on Supabase tables
- **No audio stored** — processed in memory only, deleted immediately after transcription
- **Generic error messages** — internal errors never exposed to frontend
- **Security headers** — X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy
- **CORS** — configured on all edge function responses

## Deploy

| Component | Platform |
|-----------|----------|
| Frontend | Vercel |
| Backend (Edge Functions) | Supabase |
| Database | Supabase |

## Impact

- 2 billion clinical encounters annually worldwide
- Doctors save ~2 hours of documentation time daily
- Reduces medical errors from rushed or incomplete notes
- Safety flags catch missing critical information and potential drug interactions

---

**Disclaimer:** MediScribe AI is a clinical documentation assistant, not a substitute for professional clinical judgment. All generated notes should be reviewed and approved by a qualified healthcare provider.
