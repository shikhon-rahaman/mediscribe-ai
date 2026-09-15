"use client";

import { cn } from "@/lib/utils";
import { Check, Loader2, AlertCircle, Mic, Microscope, ClipboardList } from "lucide-react";
import type { AgentStatus } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";

interface AgentStatusBarProps {
  steps: { id: string; label: string; status: AgentStatus }[];
}

const ICON_MAP: Record<string, typeof Mic> = {
  transcription: Mic,
  nlp: Microscope,
  soap: ClipboardList,
};

export function AgentStatusBar({ steps }: AgentStatusBarProps) {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4 w-full">
      {steps.map((step, index) => {
        const Icon = ICON_MAP[step.id] || Mic;
        return (
          <div key={step.id} className="flex items-center flex-1 max-w-xs">
            <AgentStep icon={Icon} label={step.label} status={step.status} />
            {index < steps.length - 1 && (
              <Connector status={step.status} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function AgentStep({
  icon: Icon,
  label,
  status,
}: {
  icon: typeof Mic;
  label: string;
  status: AgentStatus;
}) {
  const statusConfig = {
    idle: {
      ring: "border-border bg-muted/30",
      text: "text-muted-foreground",
      iconColor: "text-muted-foreground",
      dot: "bg-muted-foreground/40",
      label: "Idle",
    },
    running: {
      ring: "border-primary/50 bg-primary/10",
      text: "text-primary",
      iconColor: "text-primary",
      dot: "bg-primary",
      label: "Running...",
    },
    complete: {
      ring: "border-success/50 bg-success/10",
      text: "text-success",
      iconColor: "text-success",
      dot: "bg-success",
      label: "Complete",
    },
    error: {
      ring: "border-danger/50 bg-danger/10",
      text: "text-danger",
      iconColor: "text-danger",
      dot: "bg-danger",
      label: "Error",
    },
  };

  const config = statusConfig[status];

  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0">
      <div
        className={cn(
          "relative flex items-center justify-center w-11 h-11 rounded-full border-2 transition-all duration-300",
          config.ring,
        )}
      >
        <AnimatePresence mode="wait">
          {status === "complete" ? (
            <motion.div
              key="check"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <Check className={cn("w-5 h-5", config.iconColor)} />
            </motion.div>
          ) : status === "running" ? (
            <motion.div
              key="running"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Loader2 className={cn("w-5 h-5 animate-spin", config.iconColor)} />
            </motion.div>
          ) : status === "error" ? (
            <motion.div
              key="error"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <AlertCircle className={cn("w-5 h-5", config.iconColor)} />
            </motion.div>
          ) : (
            <Icon key="idle" className={cn("w-5 h-5", config.iconColor)} />
          )}
        </AnimatePresence>
        {status === "running" && (
          <span className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
        )}
      </div>
      <div className="text-center min-w-0">
        <p className={cn("text-[11px] font-medium truncate", config.text)}>
          {label}
        </p>
        <div className="flex items-center justify-center gap-1 mt-0.5">
          <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
          <span className="text-[10px] text-muted-foreground">{config.label}</span>
        </div>
      </div>
    </div>
  );
}

function Connector({ status }: { status: AgentStatus }) {
  return (
    <div className="flex-1 h-px mx-2 sm:mx-3 relative overflow-hidden">
      <div className="absolute inset-0 bg-border" />
      <motion.div
        className={cn(
          "absolute inset-0 origin-left",
          status === "complete" ? "bg-success" : status === "running" ? "bg-primary" : "bg-transparent",
        )}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: status === "complete" || status === "running" ? 1 : 0 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
        style={{ transformOrigin: "left" }}
      />
    </div>
  );
}
