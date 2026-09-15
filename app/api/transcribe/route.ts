import { NextRequest, NextResponse } from "next/server";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_TYPES = [
  "audio/webm",
  "audio/wav",
  "audio/mp3",
  "audio/mpeg",
  "audio/ogg",
];

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided." },
        { status: 400 },
      );
    }

    if (!ALLOWED_TYPES.includes(audioFile.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Please use audio/webm, audio/wav, audio/mp3, audio/mpeg, or audio/ogg." },
        { status: 415 },
      );
    }

    if (audioFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 25MB." },
        { status: 413 },
      );
    }

    if (audioFile.size === 0) {
      return NextResponse.json(
        { error: "Audio file is empty." },
        { status: 400 },
      );
    }

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      console.error("GROQ_API_KEY not configured");
      return NextResponse.json(
        { error: "Transcription failed. Please try again." },
        { status: 500 },
      );
    }

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
      return NextResponse.json(
        { error: "Transcription failed. Please try again." },
        { status: 500 },
      );
    }

    const result = await groqResponse.json();
    const transcript = (result.text as string)?.trim() || "";

    if (!transcript) {
      return NextResponse.json(
        { error: "No speech detected in the audio recording." },
        { status: 422 },
      );
    }

    return NextResponse.json({ transcript });
  } catch (err) {
    console.error("Transcription route error:", err);
    return NextResponse.json(
      { error: "Transcription failed. Please try again." },
      { status: 500 },
    );
  }
}
