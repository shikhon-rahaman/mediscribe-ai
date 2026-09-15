# MediScribe AI

> Giving doctors their time back with AI

## Problem

Doctors spend **2 hours documenting** for every **1 hour spent with patients**. MediScribe AI eliminates that gap.

## Solution

Three AI agents that listen to consultations and generate complete SOAP notes in under 30 seconds:

1. **Transcription Agent** — Converts audio to text using Groq Whisper Large v3
2. **Medical NLP Agent** — Extracts symptoms, medications, allergies, vitals, and red flags using GPT-OSS 120B
3. **SOAP Generator Agent** — Produces a structured, clinically accurate SOAP note with safety flags

## Architecture

```
[Microphone] → [Audio Blob] → Next.js API Route: /api/transcribe (Groq Whisper)
                                    ↓
                              [Transcript Text]
                                    ↓
                         Next.js API Route: /api/analyze (Groq GPT-OSS 120B)
                              ├── Speaker Labeler → DOCTOR/PATIENT transcript
                              ├── NLP Agent → Medical Entities
                              └── SOAP Agent → SOAP Note + Safety Flags
                                    ↓
                         Saved to the browser's localStorage
```

### Agent 1 — Transcription Agent (Groq Whisper Large v3)
- Accepts audio from the browser microphone
- Validates file type (webm, wav, mp3, mpeg, ogg) and size (max 25MB)
- Sends to Groq Whisper API for transcription
- Returns clean transcript text

### Agent 2 — Medical NLP Agent (GPT-OSS 120B)
- Accepts transcript text (max 10,000 characters)
- Extracts structured medical entities: symptoms, medications, allergies, duration, vital signs, diagnosis, red flags
- Returns validated JSON

### Agent 3 — SOAP Generator + Safety Agent (GPT-OSS 120B)
- Accepts transcript + extracted entities
- Generates a complete SOAP note (Subjective, Objective, Assessment, Plan)
- Extracts safety flags separately for prominent display

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes (Node.js runtime) |
| Storage | Browser localStorage (per-device clinical notes history) |
| AI | Groq API (openai/gpt-oss-120b + whisper-large-v3) |
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
   Fill in your Groq API key.

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000` in your browser.

## Environment Variables

See `.env.example` for all required variables. **Never commit real keys to GitHub.**

| Variable | Description |
|----------|-------------|
| `GROQ_API_KEY` | Groq API key for Whisper + GPT-OSS models (server-side only, never exposed to the browser) |

## Security

- **No hardcoded secrets** — API key in environment variables only
- **File validation** — type and size checks on audio uploads
- **Input sanitization** — HTML stripping and length validation on all inputs
- **No audio stored** — processed in memory only, deleted immediately after transcription
- **Generic error messages** — internal errors never exposed to frontend
- **Client-side note storage** — clinical notes are saved to the browser's localStorage and never leave the device

## Deploy

| Component | Platform |
|-----------|----------|
| Frontend + API Routes | Vercel |
| Storage | Browser localStorage (no external database) |

## Known Limitations

- Clinical notes history is stored per-browser (localStorage), not synced across devices or users. A future version could swap this for a proper database (e.g. Postgres) for multi-user persistence.

## Roadmap

The current build is deliberately scoped for a fast, working demo. Planned next steps toward production:

- *Persistent, multi-user storage* — replace localStorage with a proper Postgres database (e.g. via Neon or Render's managed Postgres), with a dedicated backend service hosted on Render/Railway to handle multi-user sync.
- *Authentication* — tie clinical notes to a provider account instead of a single browser/device.
- *Compliance path* — this is currently a demo, not HIPAA-compliant. A production version would need encryption at rest, audit logging, and a BAA-eligible hosting provider before handling real patient data.
- *Structured, validated model output* — add schema validation (e.g. Zod) with retry logic to guard against format drift, rather than trusting raw model output.

## Impact

- 2 billion clinical encounters annually worldwide
- Doctors save ~2 hours of documentation time daily
- Reduces medical errors from rushed or incomplete notes
- Safety flags catch missing critical information and potential drug interactions

---

**Disclaimer:** MediScribe AI is a clinical documentation assistant, not a substitute for professional clinical judgment. All generated notes should be reviewed and approved by a qualified healthcare provider.