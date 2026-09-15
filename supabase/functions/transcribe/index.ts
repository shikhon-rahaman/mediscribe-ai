import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_TYPES = [
  "audio/webm",
  "audio/wav",
  "audio/mp3",
  "audio/mpeg",
  "audio/ogg",
];

// In-memory rate limiting (per-instance best-effort)
const requestTimestamps = new Map<string, number[]>();
const RATE_LIMIT = 10; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(clientIp: string): boolean {
  const now = Date.now();
  const timestamps = requestTimestamps.get(clientIp) || [];
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW);
  if (recent.length >= RATE_LIMIT) {
    return false;
  }
  recent.push(now);
  requestTimestamps.set(clientIp, recent);
  return true;
}

function errorResponse(status: number, message: string) {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

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
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return errorResponse(400, "No audio file provided.");
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(audioFile.type)) {
      return errorResponse(415, "Unsupported file type. Please use audio/webm, audio/wav, audio/mp3, audio/mpeg, or audio/ogg.");
    }

    // Validate file size
    if (audioFile.size > MAX_FILE_SIZE) {
      return errorResponse(413, "File too large. Maximum size is 25MB.");
    }

    if (audioFile.size === 0) {
      return errorResponse(400, "Audio file is empty.");
    }

    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) {
      console.error("GROQ_API_KEY not configured");
      return errorResponse(500, "Transcription failed. Please try again.");
    }

    // Send audio to Groq Whisper API
    const groqFormData = new FormData();
    groqFormData.append("file", audioFile, "audio.webm");
    groqFormData.append("model", "whisper-large-v3");
    groqFormData.append("response_format", "json");

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
        },
        body: groqFormData,
      },
    );

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      console.error("Groq transcription error:", groqResponse.status, errText);
      return errorResponse(500, "Transcription failed. Please try again.");
    }

    const result = await groqResponse.json();
    const transcript = result.text?.trim() || "";

    if (!transcript) {
      return errorResponse(422, "No speech detected in the audio recording.");
    }

    return new Response(
      JSON.stringify({ transcript }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Transcription endpoint error:", err);
    return errorResponse(500, "Transcription failed. Please try again.");
  }
});
