"use client";

import { cn } from "@/lib/utils";
import { Mic, Square, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface RecordButtonProps {
  isRecording: boolean;
  isProcessing: boolean;
  duration: number;
  fileSize: string;
  onToggle: () => void;
  disabled?: boolean;
  error?: string | null;
}

const MAX_DURATION = 600; // 10 minutes in seconds

export function RecordButton({
  isRecording,
  isProcessing,
  duration,
  fileSize,
  onToggle,
  disabled,
  error,
}: RecordButtonProps) {
  const hasReachedMax = duration >= MAX_DURATION;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex items-center justify-center">
        {isRecording && (
          <motion.span
            className="absolute w-16 h-16 rounded-full bg-danger/20"
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 1.8, opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <motion.button
          onClick={onToggle}
          disabled={disabled || isProcessing || hasReachedMax}
          whileHover={{ scale: disabled || isProcessing ? 1 : 1.05 }}
          whileTap={{ scale: disabled || isProcessing ? 1 : 0.95 }}
          className={cn(
            "relative z-10 flex items-center justify-center w-14 h-14 rounded-full transition-all duration-300",
            "shadow-lg",
            isRecording
              ? "bg-danger text-white shadow-danger/30"
              : "bg-primary text-white shadow-primary/30 hover:shadow-primary/40",
            (disabled || isProcessing) && "opacity-50 cursor-not-allowed",
          )}
          aria-label={isRecording ? "Stop recording" : "Start recording"}
        >
          <AnimatePresence mode="wait">
            {isProcessing ? (
              <motion.div
                key="processing"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Loader2 className="w-5 h-5 animate-spin" />
              </motion.div>
            ) : isRecording ? (
              <motion.div
                key="recording"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Square className="w-5 h-5 fill-current" />
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Mic className="w-5 h-5" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      <div className="text-center">
        <AnimatePresence mode="wait">
          {isProcessing ? (
            <motion.p
              key="processing-text"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-sm text-primary font-medium"
            >
              Transcribing audio...
            </motion.p>
          ) : isRecording ? (
            <motion.p
              key="recording-text"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-sm text-danger font-medium flex items-center justify-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
              Recording... {formatTime(duration)}
            </motion.p>
          ) : hasReachedMax ? (
            <motion.p
              key="max-text"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-warning font-medium"
            >
              Max duration reached (10:00)
            </motion.p>
          ) : (
            <motion.p
              key="idle-text"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-sm text-muted-foreground"
            >
              {error ? (
                <span className="text-danger">{error}</span>
              ) : (
                "Click to start recording"
              )}
            </motion.p>
          )}
        </AnimatePresence>
        {isRecording && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-muted-foreground mt-1"
          >
            {fileSize} · auto-stops at 10:00
          </motion.p>
        )}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
