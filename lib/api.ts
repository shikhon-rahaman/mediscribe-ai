import type {
  AnalysisResponse,
  ClinicalNote,
  NotesListResponse,
} from "./types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getFunctionUrl(slug: string): string {
  return `${SUPABASE_URL}/functions/v1/${slug}`;
}

function getHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "X-Client-Info": "mediscribe-ai",
  };
}

export async function transcribeAudio(
  audioBlob: Blob,
): Promise<{ transcript?: string; error?: string }> {
  try {
    const formData = new FormData();
    const mimeType = audioBlob.type || "audio/webm";
    const extension = mimeType.includes("webm")
      ? "webm"
      : mimeType.includes("wav")
        ? "wav"
        : mimeType.includes("mp3")
          ? "mp3"
          : mimeType.includes("mpeg")
            ? "mp3"
            : "ogg";
    formData.append("audio", audioBlob, `recording.${extension}`);

    const response = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { error: data.error || "Transcription failed. Please try again." };
    }

    const data = await response.json();
    if (!data.transcript) {
      return { error: "No speech detected in the recording." };
    }
    return { transcript: data.transcript as string };
  } catch {
    return { error: "Transcription failed. Please check your connection." };
  }
}

export async function analyzeTranscript(
  transcript: string,
): Promise<{ data?: AnalysisResponse; error?: string }> {
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { error: data.error || "Analysis failed. Please try again." };
    }

    const data = await response.json();
    if (!data.soap_note || !data.entities) {
      return { error: "Analysis failed. Please try again." };
    }
    return { data: data as AnalysisResponse };
  } catch {
    return { error: "Analysis failed. Please check your connection." };
  }
}

export async function saveNote(body: {
  transcript: string;
  labeled_transcript: string;
  entities: unknown;
  soap_note: string;
  safety_flags: string[];
}): Promise<{ id?: string; error?: string }> {
  try {
    const response = await fetch("/api/save-note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { error: data.error || "Failed to save note. Please try again." };
    }

    const data = await response.json();
    return { id: data.id };
  } catch {
    return { error: "Failed to save note. Please check your connection." };
  }
}

export async function fetchNotes(
  page = 1,
  limit = 20,
): Promise<{ data?: NotesListResponse; error?: string }> {
  try {
    const url = `${getFunctionUrl("notes")}?page=${page}&limit=${limit}`;
    const response = await fetch(url, {
      method: "GET",
      headers: getHeaders(),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { error: data.error || "Failed to load notes." };
    }

    const data = await response.json();
    return { data: data as NotesListResponse };
  } catch {
    return { error: "Failed to load notes. Please check your connection." };
  }
}

export async function fetchNoteById(
  id: string,
): Promise<{ data?: ClinicalNote; error?: string }> {
  try {
    const url = `${getFunctionUrl("notes")}?id=${id}`;
    const response = await fetch(url, {
      method: "GET",
      headers: getHeaders(),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { error: data.error || "Failed to load note." };
    }

    const data = await response.json();
    return { data: data as ClinicalNote };
  } catch {
    return { error: "Failed to load note. Please check your connection." };
  }
}

export async function deleteNote(
  id: string,
): Promise<{ error?: string }> {
  try {
    const url = `${getFunctionUrl("notes")}?id=${id}`;
    const response = await fetch(url, {
      method: "DELETE",
      headers: getHeaders(),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { error: data.error || "Failed to delete note." };
    }

    return {};
  } catch {
    return { error: "Failed to delete note. Please check your connection." };
  }
}
