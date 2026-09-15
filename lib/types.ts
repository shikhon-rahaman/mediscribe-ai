export interface Entities {
  symptoms: string[];
  medications: string[];
  allergies: string[];
  duration: string;
  vital_signs: string;
  diagnosis: string;
  red_flags: string[];
}

export interface AnalysisResponse {
  labeled_transcript: string;
  entities: Entities;
  soap_note: string;
  safety_flags: string[];
  processing_time_ms: number;
}

export interface ClinicalNote {
  id: string;
  transcript: string;
  labeled_transcript: string | null;
  entities: Entities | null;
  soap_note: string;
  safety_flags: string[];
  created_at: string;
  updated_at: string;
}

export interface NotesListResponse {
  notes: ClinicalNote[];
  total: number;
  page: number;
  limit: number;
}

export type AgentStatus = "idle" | "running" | "complete" | "error";

export interface AgentStep {
  id: string;
  label: string;
  icon: string;
  status: AgentStatus;
}

export type RecordingState = "idle" | "recording" | "paused";

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}
