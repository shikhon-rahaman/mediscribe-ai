"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Trash2, FileText, ChevronRight, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { fetchNotes, deleteNote } from "@/lib/api";
import type { ClinicalNote } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";

export default function NotesPage() {
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<ClinicalNote | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchNotes(1, 50);
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setNotes(result.data.notes);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const result = await deleteNote(id);
    if (result.error) {
      setError(result.error);
      setDeleting(null);
    } else {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (selectedNote?.id === id) setSelectedNote(null);
      setDeleting(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </Link>
            <div className="h-4 w-px bg-border" />
            <h1 className="text-lg font-bold text-foreground">Clinical Notes History</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 py-6">
        {error && (
          <div className="mb-4 rounded-lg bg-danger/10 border border-danger/30 p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0" />
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 rounded-xl animate-shimmer" />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
              <FileText className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium text-foreground">No saved notes yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Record a consultation and save the SOAP note to see it here
            </p>
            <Link
              href="/"
              className="mt-4 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Start Recording
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Notes List */}
            <div className="space-y-3">
              <AnimatePresence>
                {notes.map((note, i) => (
                  <motion.div
                    key={note.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: i * 0.05 }}
                    layout
                  >
                    <NoteCard
                      note={note}
                      isSelected={selectedNote?.id === note.id}
                      onSelect={() => setSelectedNote(note)}
                      onDelete={() => handleDelete(note.id)}
                      isDeleting={deleting === note.id}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Selected Note Detail */}
            <div className="lg:sticky lg:top-20 h-fit">
              {selectedNote ? (
                <NoteDetail note={selectedNote} />
              ) : (
                <div className="rounded-xl border border-border bg-card p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    Select a note to view details
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function NoteCard({
  note,
  isSelected,
  onSelect,
  onDelete,
  isDeleting,
}: {
  note: ClinicalNote;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const date = new Date(note.created_at);
  const formattedDate = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const preview = note.transcript.slice(0, 100) + (note.transcript.length > 100 ? "..." : "");
  const flagCount = note.safety_flags?.length || 0;

  return (
    <div
      onClick={onSelect}
      className={`group cursor-pointer rounded-xl border p-4 transition-all ${
        isSelected
          ? "border-primary/50 bg-primary/5"
          : "border-border bg-card hover:border-border/80 hover:bg-muted/20"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground">{formattedDate}</span>
            {flagCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-danger">
                <AlertTriangle className="w-3 h-3" />
                {flagCount} flag{flagCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="text-sm text-foreground/90 line-clamp-2">{preview}</p>
          {note.entities?.diagnosis && (
            <p className="text-xs text-primary mt-1 truncate">
              {note.entities.diagnosis}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <ChevronRight
            className={`w-4 h-4 transition-colors ${
              isSelected ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
            }`}
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            disabled={isDeleting}
            className="p-1.5 rounded-md text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
            aria-label="Delete note"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function NoteDetail({ note }: { note: ClinicalNote }) {
  const date = new Date(note.created_at);
  const formattedDate = date.toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-border">
        <p className="text-xs text-muted-foreground">{formattedDate}</p>
      </div>

      <div className="max-h-[calc(100vh-200px)] overflow-y-auto scrollbar-thin">
        {note.entities && (
          <div className="px-4 py-3 border-b border-border">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Entities
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {note.entities.symptoms?.map((s, i) => (
                <span key={`s${i}`} className="px-2 py-0.5 rounded-full text-xs bg-danger/15 text-danger border border-danger/30">
                  {s}
                </span>
              ))}
              {note.entities.medications?.map((m, i) => (
                <span key={`m${i}`} className="px-2 py-0.5 rounded-full text-xs bg-primary/15 text-primary border border-primary/30">
                  {m}
                </span>
              ))}
              {note.entities.allergies?.map((a, i) => (
                <span key={`a${i}`} className="px-2 py-0.5 rounded-full text-xs bg-warning/15 text-warning border border-warning/30">
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="px-4 py-3 border-b border-border">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Transcript
          </h4>
          <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {note.transcript}
          </p>
        </div>

        <div className="px-4 py-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            SOAP Note
          </h4>
          <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap font-mono">
            {note.soap_note}
          </p>
        </div>

        {note.safety_flags && note.safety_flags.length > 0 && (
          <div className="mx-4 mb-4 rounded-lg bg-danger/10 border border-danger/30 p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-danger" />
              <span className="text-xs font-bold text-danger uppercase tracking-wide">
                Safety Flags
              </span>
            </div>
            <div className="space-y-1.5">
              {note.safety_flags.map((flag, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-danger mt-1.5 flex-shrink-0" />
                  <span className="text-sm text-danger/90">{flag}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
