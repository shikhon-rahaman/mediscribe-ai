"use client";

import { cn } from "@/lib/utils";
import { Copy, Check, FileText } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TranscriptPanelProps {
  transcript: string;
  isTranscribing: boolean;
  error: string | null;
}

export function TranscriptPanel({
  transcript,
  isTranscribing,
  error,
}: TranscriptPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const segments = parseTranscript(transcript);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Live Transcript</h3>
        </div>
        {transcript && !isTranscribing && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-success" />
                <span className="text-success">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mb-3">
              <FileText className="w-5 h-5 text-danger" />
            </div>
            <p className="text-sm text-danger font-medium">Transcription Error</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">{error}</p>
          </div>
        ) : isTranscribing ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 w-16 rounded animate-shimmer" />
                <div className="h-4 w-full rounded animate-shimmer" />
                <div className="h-4 w-3/4 rounded animate-shimmer" />
              </div>
            ))}
          </div>
        ) : transcript && segments.length > 0 ? (
          <div className="space-y-4">
            <AnimatePresence>
              {segments.map((seg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.3 }}
                  className="space-y-1"
                >
                  <span
                    className={cn(
                      "inline-block text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded",
                      seg.speaker === "DOCTOR"
                        ? "bg-primary/15 text-primary"
                        : seg.speaker === "PATIENT"
                          ? "bg-muted text-muted-foreground"
                          : "bg-muted/50 text-muted-foreground",
                    )}
                  >
                    {seg.speaker}
                  </span>
                  <p className="text-sm text-foreground/90 leading-relaxed">
                    {seg.text}
                  </p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : transcript ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap"
          >
            {transcript}
          </motion.p>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center mb-3">
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No transcript yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Record a consultation to begin
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function parseTranscript(transcript: string): { speaker: string; text: string }[] {
  const lines = transcript.split("\n").filter((l) => l.trim());
  const segments: { speaker: string; text: string }[] = [];

  for (const line of lines) {
    const match = line.match(/^(Doctor|Patient|DOCTOR|PATIENT|Dr\.|Pt\.)\s*:?/i);
    if (match) {
      const speaker = match[1].toUpperCase().startsWith("DR")
        ? "DOCTOR"
        : "PATIENT";
      const text = line.replace(match[0], "").trim();
      if (text) segments.push({ speaker, text });
    } else if (segments.length > 0) {
      segments[segments.length - 1].text += " " + line.trim();
    } else {
      segments.push({ speaker: "NOTES", text: line.trim() });
    }
  }

  return segments;
}
