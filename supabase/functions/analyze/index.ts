const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_TRANSCRIPT_LENGTH = 10000;

// In-memory rate limiting (per-instance best-effort)
const requestTimestamps = new Map<string, number[]>();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 1000;

function checkRateLimit(clientIp: string): boolean {
  const now = Date.now();
  const timestamps = requestTimestamps.get(clientIp) || [];
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW);
  if (recent.length >= RATE_LIMIT) return false;
  recent.push(now);
  requestTimestamps.set(clientIp, recent);
  return true;
}

function errorResponse(status: number, message: string) {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed.");
  }

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  if (!checkRateLimit(clientIp)) {
    return errorResponse(429, "Rate limit exceeded. Please try again later.");
  }

  try {
    const body = await req.json();
    const { transcript } = body as { transcript?: string };

    if (!transcript || typeof transcript !== "string") {
      return errorResponse(400, "Transcript is required.");
    }

    const cleanTranscript = stripHtml(transcript);

    if (cleanTranscript.length > MAX_TRANSCRIPT_LENGTH) {
      return errorResponse(400, "Transcript exceeds maximum length of 10,000 characters.");
    }

    if (cleanTranscript.length === 0) {
      return errorResponse(400, "Transcript is empty.");
    }

    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) {
      console.error("GROQ_API_KEY not configured");
      return errorResponse(500, "Analysis failed. Please try again.");
    }

    const startTime = Date.now();

    // Step 1: NLP entity extraction with Llama 3.3 70B
    const nlpResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: NLP_PROMPT },
            { role: "user", content: cleanTranscript },
          ],
          temperature: 0.2,
          max_tokens: 2048,
        }),
      },
    );

    if (!nlpResponse.ok) {
      const errText = await nlpResponse.text();
      console.error("Groq NLP error:", nlpResponse.status, errText);
      return errorResponse(500, "Analysis failed. Please try again.");
    }

    const nlpResult = await nlpResponse.json();
    const nlpContent = nlpResult.choices?.[0]?.message?.content || "";

    let entities: Entities;
    try {
      // Extract JSON from the response (handle markdown code fences)
      const jsonMatch = nlpContent.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : nlpContent);
      if (!validateEntities(parsed)) {
        throw new Error("Invalid entity structure");
      }
      entities = parsed;
    } catch {
      console.error("Failed to parse NLP response:", nlpContent);
      return errorResponse(500, "Analysis failed. Please try again.");
    }

    // Step 2: SOAP note generation with Llama 3.3 70B
    const soapInput = `Transcript:
${cleanTranscript}

Extracted Entities:
${JSON.stringify(entities, null, 2)}`;

    const soapResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: SOAP_PROMPT },
            { role: "user", content: soapInput },
          ],
          temperature: 0.3,
          max_tokens: 2048,
        }),
      },
    );

    if (!soapResponse.ok) {
      const errText = await soapResponse.text();
      console.error("Groq SOAP error:", soapResponse.status, errText);
      return errorResponse(500, "Analysis failed. Please try again.");
    }

    const soapResult = await soapResponse.json();
    const soapNote = soapResult.choices?.[0]?.message?.content?.trim() || "";

    if (!soapNote) {
      return errorResponse(500, "Analysis failed. Please try again.");
    }

    // Extract safety flags from SOAP note
    const safetyFlags: string[] = [];
    const flagsMatch = soapNote.match(/SAFETY FLAGS:\s*([\s\S]*?)(?:\n\n|$)/i);
    if (flagsMatch && flagsMatch[1]) {
      const flagsText = flagsMatch[1].trim();
      if (flagsText.toUpperCase() !== "NONE") {
        const lines = flagsText.split("\n").map((l) => l.trim()).filter((l) =>
          l && !l.match(/^[-•*]\s*$/) && l !== "NONE"
        );
        for (const line of lines) {
          const cleaned = line.replace(/^[-•*\d.\)]+\s*/, "").trim();
          if (cleaned) safetyFlags.push(cleaned);
        }
      }
    }

    // Build labeled transcript with entity annotations
    const labeledTranscript = buildLabeledTranscript(cleanTranscript, entities);

    const processingTimeMs = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        labeled_transcript: labeledTranscript,
        entities,
        soap_note: soapNote,
        safety_flags: safetyFlags,
        processing_time_ms: processingTimeMs,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Analyze endpoint error:", err);
    return errorResponse(500, "Analysis failed. Please try again.");
  }
});

function buildLabeledTranscript(transcript: string, entities: Entities): string {
  let labeled = transcript;
  const allEntities = [
    ...entities.symptoms.map((s) => ({ text: s, type: "SYMPTOM" })),
    ...entities.medications.map((m) => ({ text: m, type: "MEDICATION" })),
    ...entities.allergies.map((a) => ({ text: a, type: "ALLERGY" })),
  ];
  for (const entity of allEntities) {
    if (entity.text && entity.text.length > 2) {
      const escaped = entity.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(${escaped})`, "gi");
      labeled = labeled.replace(
        regex,
        `[$entity.type: $1]`,
      );
    }
  }
  return labeled;
}
