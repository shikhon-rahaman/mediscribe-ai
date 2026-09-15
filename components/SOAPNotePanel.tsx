"use client";

import { cn } from "@/lib/utils";
import {
  ClipboardList,
  Copy,
  Check,
  Save,
  AlertTriangle,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SOAPNotePanelProps {
  soapNote: string | null;
  safetyFlags: string[];
  isGenerating: boolean;
  error: string | null;
  onSave: () => void;
  isSaving: boolean;
  saveSuccess: boolean;
}

export function SOAPNotePanel({
  soapNote,
  safetyFlags,
  isGenerating,
  error,
  onSave,
  isSaving,
  saveSuccess,
}: SOAPNotePanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!soapNote) return;
    navigator.clipboard.writeText(soapNote);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sections = parseSOAPSections(soapNote || "");
  const canSave = soapNote && !isGenerating && !error;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">SOAP Note</h3>
        </div>
        {soapNote && !isGenerating && (
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
                <span>Copy Note</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5 text-danger" />
            </div>
            <p className="text-sm text-danger font-medium">Generation Error</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">{error}</p>
          </div>
        ) : isGenerating ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-16 rounded animate-shimmer" />
                <div className="h-3 w-full rounded animate-shimmer" />
                <div className="h-3 w-5/6 rounded animate-shimmer" />
                <div className="h-3 w-3/4 rounded animate-shimmer" />
              </div>
            ))}
          </div>
        ) : sections.length > 0 ? (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              {sections.map((section, i) => (
                <SOAPSection key={section.label} section={section} index={i} />
              ))}

              {safetyFlags.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="rounded-lg bg-danger/10 border border-danger/30 p-3 mt-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-danger" />
                    <span className="text-xs font-bold text-danger uppercase tracking-wide">
                      Safety Flags
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {safetyFlags.map((flag, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + i * 0.08 }}
                        className="flex items-start gap-2"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-danger mt-1.5 flex-shrink-0" />
                        <span className="text-sm text-danger/90">{flag}</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center mb-3">
              <ClipboardList className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No SOAP note yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              The note will appear here after analysis
            </p>
          </div>
        )}
      </div>

      {canSave && (
        <div className="border-t border-border px-4 py-3">
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onSave}
            disabled={isSaving || saveSuccess}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all",
              saveSuccess
                ? "bg-success/15 text-success border border-success/30"
                : "bg-success text-white hover:bg-success/90 shadow-lg shadow-success/20",
            )}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : saveSuccess ? (
              <>
                <ShieldCheck className="w-4 h-4" />
                Signed & Saved
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Sign & Save
              </>
            )}
          </motion.button>
        </div>
      )}
    </div>
  );
}

const SECTION_COLORS: Record<string, string> = {
  SUBJECTIVE: "border-l-primary",
  OBJECTIVE: "border-l-success",
  ASSESSMENT: "border-l-warning",
  PLAN: "border-l-chart-1",
};

const SECTION_LABELS: Record<string, string> = {
  SUBJECTIVE: "S",
  OBJECTIVE: "O",
  ASSESSMENT: "A",
  PLAN: "P",
};

interface SOAPSectionData {
  label: string;
  content: string;
}

function SOAPSection({ section, index }: { section: SOAPSectionData; index: number }) {
  const borderColor = SECTION_COLORS[section.label] || "border-l-muted";
  const letter = SECTION_LABELS[section.label] || section.label.charAt(0);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.12 }}
      className={cn(
        "pl-3 border-l-2",
        borderColor,
      )}
    >
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-lg font-bold text-foreground/80">{letter}</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {section.label.charAt(0) + section.label.slice(1).toLowerCase()}
        </span>
      </div>
      <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
        {section.content}
      </p>
    </motion.div>
  );
}

function parseSOAPSections(soapNote: string): SOAPSectionData[] {
  const sections: SOAPSectionData[] = [];
  const sectionRegex =
    /(SUBJECTIVE|OBJECTIVE|ASSESSMENT|PLAN|SAFETY FLAGS)\s*:?\s*([\s\S]*?)(?=(?:SUBJECTIVE|OBJECTIVE|ASSESSMENT|PLAN|SAFETY FLAGS)\s*:|$)/gi;

  let match;
  while ((match = sectionRegex.exec(soapNote)) !== null) {
    const label = match[1].toUpperCase();
    if (label !== "SAFETY FLAGS") {
      sections.push({
        label,
        content: match[2].trim(),
      });
    }
  }

  if (sections.length === 0 && soapNote.trim()) {
    sections.push({ label: "SUBJECTIVE", content: soapNote.trim() });
  }

  return sections;
}
