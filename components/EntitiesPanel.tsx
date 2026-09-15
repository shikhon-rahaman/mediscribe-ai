"use client";

import { cn } from "@/lib/utils";
import {
  HeartPulse,
  Pill,
  AlertTriangle,
  Clock,
  Activity,
  Stethoscope,
  TriangleAlert,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Entities } from "@/lib/types";

interface EntitiesPanelProps {
  entities: Entities | null;
  isAnalyzing: boolean;
  error: string | null;
}

export function EntitiesPanel({
  entities,
  isAnalyzing,
  error,
}: EntitiesPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Stethoscope className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Extracted Entities</h3>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5 text-danger" />
            </div>
            <p className="text-sm text-danger font-medium">Analysis Error</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">{error}</p>
          </div>
        ) : isAnalyzing ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-20 rounded animate-shimmer" />
                <div className="flex gap-2">
                  <div className="h-6 w-24 rounded-full animate-shimmer" />
                  <div className="h-6 w-20 rounded-full animate-shimmer" />
                </div>
              </div>
            ))}
          </div>
        ) : entities ? (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <EntitySection
                icon={HeartPulse}
                title="Symptoms"
                items={entities.symptoms}
                variant="danger"
              />
              <EntitySection
                icon={Pill}
                title="Medications"
                items={entities.medications}
                variant="primary"
              />
              <EntitySection
                icon={AlertTriangle}
                title="Allergies"
                items={entities.allergies}
                variant="warning"
              />
              {entities.duration && (
                <EntityField
                  icon={Clock}
                  label="Duration"
                  value={entities.duration}
                />
              )}
              {entities.vital_signs && (
                <EntityField
                  icon={Activity}
                  label="Vital Signs"
                  value={entities.vital_signs}
                />
              )}
              {entities.diagnosis && (
                <EntityField
                  icon={Stethoscope}
                  label="Diagnosis"
                  value={entities.diagnosis}
                />
              )}

              {entities.red_flags.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="rounded-lg bg-danger/10 border border-danger/30 p-3"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <TriangleAlert className="w-4 h-4 text-danger" />
                    <span className="text-xs font-bold text-danger uppercase tracking-wide">
                      Red Flags
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {entities.red_flags.map((flag, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + i * 0.08 }}
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
              <Stethoscope className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No entities extracted</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Analysis will appear here after transcription
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const VARIANT_STYLES = {
  danger: "bg-danger/15 text-danger border-danger/30",
  primary: "bg-primary/15 text-primary border-primary/30",
  warning: "bg-warning/15 text-warning border-warning/30",
};

function EntitySection({
  icon: Icon,
  title,
  items,
  variant,
}: {
  icon: typeof HeartPulse;
  title: string;
  items: string[];
  variant: "danger" | "primary" | "warning";
}) {
  if (!items || items.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.06 }}
            className={cn(
              "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border",
              VARIANT_STYLES[variant],
            )}
          >
            {item}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

function EntityField({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof HeartPulse;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="text-sm text-foreground/90 leading-relaxed">{value}</p>
    </div>
  );
}
