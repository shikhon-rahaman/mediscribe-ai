import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const MAX_TRANSCRIPT_LENGTH = 10000;
const MAX_SOAP_LENGTH = 20000;

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

export async function POST(req: NextRequest) {
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

    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json(
        { error: "Transcript is required." },
        { status: 400 },
      );
    }
    if (!soap_note || typeof soap_note !== "string") {
      return NextResponse.json(
        { error: "SOAP note is required." },
        { status: 400 },
      );
    }

    const cleanTranscript = stripHtml(transcript);
    const cleanSoapNote = stripHtml(soap_note);

    if (cleanTranscript.length > MAX_TRANSCRIPT_LENGTH) {
      return NextResponse.json(
        { error: "Transcript exceeds maximum length." },
        { status: 400 },
      );
    }
    if (cleanSoapNote.length > MAX_SOAP_LENGTH) {
      return NextResponse.json(
        { error: "SOAP note exceeds maximum length." },
        { status: 400 },
      );
    }
    if (cleanTranscript.length === 0 || cleanSoapNote.length === 0) {
      return NextResponse.json(
        { error: "Transcript and SOAP note cannot be empty." },
        { status: 400 },
      );
    }

    let validatedEntities: Record<string, unknown> | null = null;
    if (entities) {
      if (!validateEntities(entities)) {
        return NextResponse.json(
          { error: "Invalid entities structure." },
          { status: 400 },
        );
      }
      validatedEntities = entities as Record<string, unknown>;
    }

    let validatedFlags: unknown[] = [];
    if (safety_flags) {
      if (!Array.isArray(safety_flags)) {
        return NextResponse.json(
          { error: "Safety flags must be an array." },
          { status: 400 },
        );
      }
      validatedFlags = safety_flags;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Supabase credentials not configured");
      return NextResponse.json(
        { error: "Failed to save note. Please try again." },
        { status: 500 },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      return NextResponse.json(
        { error: "Failed to save note. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        id: data.id,
        created_at: data.created_at,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Save note route error:", err);
    return NextResponse.json(
      { error: "Failed to save note. Please try again." },
      { status: 500 },
    );
  }
}
