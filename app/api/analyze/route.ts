import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_TRANSCRIPT_LENGTH = 10000;

interface Entities {
  symptoms: string[];
  medications: string[];
  allergies: string[];
  duration: string;
  vital_signs: string;
  diagnosis: string;
  red_flags: string[];
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "").trim();
}

function validateEntities(data: unknown): data is Entities {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    Array.isArray(obj.symptoms) &&
    Array.isArray(obj.medications) &&
    Array.isArray(obj.allergies) &&
    typeof obj.duration === "string" &&
    typeof obj.vital_signs === "string" &&
    typeof obj.diagnosis === "string" &&
    Array.isArray(obj.red_flags)
  );
}

async function callGroq(
  apiKey: string,
  systemPrompt: string,
  userContent: string,
  temperature = 0.2,
): Promise<string> {
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature,
        max_tokens: 2048,
      }),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("Groq LLM error:", response.status, errText);
    throw new Error("LLM request failed");
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content?.trim() || "";
}

const LABELER_PROMPT = `You are a medical conversation labeler. Given a doctor-patient consultation transcript, label each line with either DOCTOR: or PATIENT: at the start.

Rules:
- Identify speakers based on context (questions about symptoms = doctor, describing symptoms = patient)
- Keep the original text intact
- If you cannot determine the speaker, label as DOCTOR:
- Do not add any explanation, only output the labeled transcript

Format:
DOCTOR: [text]
PATIENT: [text]
DOCTOR: [text]
...`;

const NLP_PROMPT = `You are a medical NLP agent. Extract all medical entities from this doctor-patient consultation transcript. Return ONLY valid JSON with these exact keys:
{
  "symptoms": string[],
  "medications": string[],
  "allergies": string[],
  "duration": string,
  "vital_signs": string,
  "diagnosis": string,
  "red_flags": string[]
}
Return nothing else. No explanation. Only JSON.`;

const SOAP_PROMPT = `You are a senior clinical documentation specialist. Generate a complete, professional SOAP note from this consultation. Be precise and clinically accurate.

Format exactly as:
SUBJECTIVE:
[Patient's chief complaint, history, symptoms in patient's own words]

OBJECTIVE:
[Clinical observations, vitals, examination findings]

ASSESSMENT:
[Diagnosis with clinical reasoning]

PLAN:
[Treatment plan, medications with dosages, follow-up instructions, referrals]

SAFETY FLAGS:
[List any: missing critical information, potential drug interactions, urgent concerns requiring immediate attention. Write NONE if no flags.]`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transcript } = body as { transcript?: string };

    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json(
        { error: "Transcript is required." },
        { status: 400 },
      );
    }

    const cleanTranscript = stripHtml(transcript);

    if (cleanTranscript.length > MAX_TRANSCRIPT_LENGTH) {
      return NextResponse.json(
        { error: "Transcript exceeds maximum length of 10,000 characters." },
        { status: 400 },
      );
    }

    if (cleanTranscript.length === 0) {
      return NextResponse.json(
        { error: "Transcript is empty." },
        { status: 400 },
      );
    }

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      console.error("GROQ_API_KEY not configured");
      return NextResponse.json(
        { error: "Analysis failed. Please try again." },
        { status: 500 },
      );
    }

    const startTime = Date.now();

    // Agent 1: Label transcript with DOCTOR/PATIENT speakers
    const labeledTranscript = await callGroq(
      groqApiKey,
      LABELER_PROMPT,
      cleanTranscript,
      0.2,
    );

    // Agent 2: Extract medical entities as JSON
    const nlpContent = await callGroq(
      groqApiKey,
      NLP_PROMPT,
      cleanTranscript,
      0.2,
    );

    let entities: Entities;
    try {
      const jsonMatch = nlpContent.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : nlpContent);
      if (!validateEntities(parsed)) {
        throw new Error("Invalid entity structure");
      }
      entities = parsed;
    } catch {
      console.error("Failed to parse NLP response:", nlpContent);
      return NextResponse.json(
        { error: "Analysis failed. Please try again." },
        { status: 500 },
      );
    }

    // Agent 3: Generate SOAP note
    const soapInput = `Transcript:
${cleanTranscript}

Extracted Entities:
${JSON.stringify(entities, null, 2)}`;

    const soapNote = await callGroq(
      groqApiKey,
      SOAP_PROMPT,
      soapInput,
      0.3,
    );

    if (!soapNote) {
      return NextResponse.json(
        { error: "Analysis failed. Please try again." },
        { status: 500 },
      );
    }

    // Extract safety flags from SOAP note
    const safetyFlags: string[] = [];
    const flagsMatch = soapNote.match(/SAFETY FLAGS:\s*([\s\S]*?)(?:\n\n|$)/i);
    if (flagsMatch && flagsMatch[1]) {
      const flagsText = flagsMatch[1].trim();
      if (flagsText.toUpperCase() !== "NONE") {
        const lines = flagsText
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l && l !== "NONE");
        for (const line of lines) {
          const cleaned = line.replace(/^[-•*\d.\)]+\s*/, "").trim();
          if (cleaned) safetyFlags.push(cleaned);
        }
      }
    }

    const processingTimeMs = Date.now() - startTime;

    return NextResponse.json({
      labeled_transcript: labeledTranscript,
      entities,
      soap_note: soapNote,
      safety_flags: safetyFlags,
      processing_time_ms: processingTimeMs,
    });
  } catch (err) {
    console.error("Analyze route error:", err);
    return NextResponse.json(
      { error: "Analysis failed. Please try again." },
      { status: 500 },
    );
  }
}