import type {
  AnalysisResponse,
  ClinicalNote,
  NotesListResponse,
} from "./types";

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

const NOTES_STORAGE_KEY = "mediscribe_clinical_notes";

function readStoredNotes(): ClinicalNote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NOTES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ClinicalNote[]) : [];
  } catch {
    return [];
  }
}

function writeStoredNotes(notes: ClinicalNote[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `note_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export async function saveNote(body: {
  transcript: string;
  labeled_transcript: string;
  entities: unknown;
  soap_note: string;
  safety_flags: string[];
}): Promise<{ id?: string; error?: string }> {
  try {
    const now = new Date().toISOString();
    const note: ClinicalNote = {
      id: generateId(),
      transcript: body.transcript,
      labeled_transcript: body.labeled_transcript ?? null,
      entities: (body.entities as ClinicalNote["entities"]) ?? null,
      soap_note: body.soap_note,
      safety_flags: body.safety_flags ?? [],
      created_at: now,
      updated_at: now,
    };

    const notes = readStoredNotes();
    notes.unshift(note);
    writeStoredNotes(notes);

    return { id: note.id };
  } catch {
    return { error: "Failed to save note. Please try again." };
  }
}

export async function fetchNotes(
  page = 1,
  limit = 20,
): Promise<{ data?: NotesListResponse; error?: string }> {
  try {
    const notes = readStoredNotes();
    const offset = (page - 1) * limit;
    return {
      data: {
        notes: notes.slice(offset, offset + limit),
        total: notes.length,
        page,
        limit,
      },
    };
  } catch {
    return { error: "Failed to load notes. Please try again." };
  }
}

export async function fetchNoteById(
  id: string,
): Promise<{ data?: ClinicalNote; error?: string }> {
  try {
    const notes = readStoredNotes();
    const note = notes.find((n) => n.id === id);
    if (!note) {
      return { error: "Note not found." };
    }
    return { data: note };
  } catch {
    return { error: "Failed to load note. Please try again." };
  }
}

export async function deleteNote(
  id: string,
): Promise<{ error?: string }> {
  try {
    const notes = readStoredNotes();
    writeStoredNotes(notes.filter((n) => n.id !== id));
    return {};
  } catch {
    return { error: "Failed to delete note. Please try again." };
  }
}