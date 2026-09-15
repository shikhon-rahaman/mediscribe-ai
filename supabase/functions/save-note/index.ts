import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_TRANSCRIPT_LENGTH = 10000;
const MAX_SOAP_LENGTH = 20000;

// In-memory rate limiting
const requestTimestamps = new Map<string, number[]>();
const RATE_LIMIT = 20;
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

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "").trim();
}

function validateEntities(data: unknown): boolean {
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
    const {
      transcript,
      labeled_transcript,
      entities,
      soap_note,
      safety_flags,
    } = body as {
      transcript?: string;
      labeled_transcript?: string;
      entities?: unknown;
      soap_note?: string;
      safety_flags?: unknown;
    };

    // Validate required fields
    if (!transcript || typeof transcript !== "string") {
      return errorResponse(400, "Transcript is required.");
    }
    if (!soap_note || typeof soap_note !== "string") {
      return errorResponse(400, "SOAP note is required.");
    }

    const cleanTranscript = stripHtml(transcript);
    const cleanSoapNote = stripHtml(soap_note);

    if (cleanTranscript.length > MAX_TRANSCRIPT_LENGTH) {
      return errorResponse(400, "Transcript exceeds maximum length.");
    }
    if (cleanSoapNote.length > MAX_SOAP_LENGTH) {
      return errorResponse(400, "SOAP note exceeds maximum length.");
    }
    if (cleanTranscript.length === 0 || cleanSoapNote.length === 0) {
      return errorResponse(400, "Transcript and SOAP note cannot be empty.");
    }

    // Validate entities structure
    let validatedEntities: Record<string, unknown> | null = null;
    if (entities) {
      if (!validateEntities(entities)) {
        return errorResponse(400, "Invalid entities structure.");
      }
      validatedEntities = entities as Record<string, unknown>;
    }

    // Validate safety_flags is an array
    let validatedFlags: unknown[] = [];
    if (safety_flags) {
      if (!Array.isArray(safety_flags)) {
        return errorResponse(400, "Safety flags must be an array.");
      }
      validatedFlags = safety_flags;
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.error("Supabase credentials not configured");
      return errorResponse(500, "Failed to save note. Please try again.");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from("clinical_notes")
      .insert({
        transcript: cleanTranscript,
        labeled_transcript: labeled_transcript
          ? stripHtml(labeled_transcript)
          : null,
        entities: validatedEntities,
        soap_note: cleanSoapNote,
        safety_flags: validatedFlags,
      })
      .select("id, created_at")
      .single();

    if (error) {
      console.error("Database insert error:", error.message);
      return errorResponse(500, "Failed to save note. Please try again.");
    }

    return new Response(
      JSON.stringify({
        id: data.id,
        created_at: data.created_at,
        message: "Note saved successfully.",
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Save note endpoint error:", err);
    return errorResponse(500, "Failed to save note. Please try again.");
  }
});
