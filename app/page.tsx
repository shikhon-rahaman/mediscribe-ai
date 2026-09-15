"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Activity, History, HeartPulse } from "lucide-react";
import { AgentStatusBar } from "@/components/AgentStatusBar";
import { RecordButton } from "@/components/RecordButton";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { EntitiesPanel } from "@/components/EntitiesPanel";
import { SOAPNotePanel } from "@/components/SOAPNotePanel";
import { transcribeAudio, analyzeTranscript, saveNote } from "@/lib/api";
import type { AgentStatus, Entities, AnalysisResponse } from "@/lib/types";
import Link from "next/link";

const MAX_DURATION = 600; // 10 minutes

interface AgentStepState {
  id: string;
  label: string;
  status: AgentStatus;
}

const INITIAL_STEPS: AgentStepState[] = [
  { id: "transcription", label: "Transcription Agent", status: "idle" },
  { id: "nlp", label: "Medical NLP Agent", status: "idle" },
  { id: "soap", label: "SOAP Generator", status: "idle" },
];

export default function HomePage() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [fileSize, setFileSize] = useState("0 KB");

  const [transcript, setTranscript] = useState("");
  const [transcriptError, setTranscriptError] = useState<string | null>(null);

  const [analysisData, setAnalysisData] = useState<AnalysisResponse | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [agentSteps, setAgentSteps] = useState<AgentStepState[]>(INITIAL_STEPS);
  const [recordError, setRecordError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const updateStep = useCallback(
    (id: string, status: AgentStatus) => {
      setAgentSteps((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status } : s)),
      );
    },
    [],
  );

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleStartRecording = useCallback(async () => {
    setRecordError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          setFileSize(formatBytes(chunksRef.current.reduce((a, c) => a + c.size, 0)));
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        cleanupStream();

        if (audioBlob.size === 0) {
          setTranscriptError("Recording was empty. Please try again.");
          setIsProcessing(false);
          return;
        }

        // Start transcription
        setIsProcessing(true);
        updateStep("transcription", "running");
        setTranscriptError(null);

        const result = await transcribeAudio(audioBlob);

        if (result.error) {
          setTranscriptError(result.error);
          updateStep("transcription", "error");
          setIsProcessing(false);
          return;
        }

        setTranscript(result.transcript || "");
        updateStep("transcription", "complete");
        setIsProcessing(false);

        // Auto-trigger analysis
        if (result.transcript) {
          await runAnalysis(result.transcript);
        }
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setDuration(0);
      startTimeRef.current = Date.now();

      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);
        if (elapsed >= MAX_DURATION) {
          handleStopRecording();
        }
      }, 1000);
    } catch (error: unknown) {
  console.error("Microphone access error:", error);

  setIsRecording(false);

  if (error instanceof DOMException && error.name === "NotAllowedError") {
    setRecordError(
      "Microphone is blocked. Allow microphone access in your browser's site settings, then tap the microphone again."
    );
    return;
  }

  if (error instanceof DOMException && error.name === "NotFoundError") {
    setRecordError(
      "No microphone was found. Please connect or enable a microphone and try again."
    );
    return;
  }

  if (error instanceof DOMException && error.name === "NotReadableError") {
    setRecordError(
      "The microphone is currently being used by another application. Close it and try again."
    );
    return;
  }

  setRecordError(
    "Unable to access the microphone. Please check your browser permissions and try again."
  );
}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanupStream, updateStep]);

  const handleStopRecording = useCallback(() => {
    stopTimer();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, [stopTimer]);

  const runAnalysis = useCallback(
    async (text: string) => {
      updateStep("nlp", "running");
      updateStep("soap", "running");
      setAnalysisError(null);
      setAnalysisData(null);
      setSaveSuccess(false);

      const result = await analyzeTranscript(text);

      if (result.error) {
        setAnalysisError(result.error);
        updateStep("nlp", "error");
        updateStep("soap", "error");
        return;
      }

      if (result.data) {
        setAnalysisData(result.data);
        updateStep("nlp", "complete");
        updateStep("soap", "complete");
      }
    },
    [updateStep],
  );

  const handleSave = useCallback(async () => {
    if (!analysisData || !transcript) return;

    setIsSaving(true);
    setSaveSuccess(false);

    const result = await saveNote({
      transcript,
      labeled_transcript: analysisData.labeled_transcript,
      entities: analysisData.entities,
      soap_note: analysisData.soap_note,
      safety_flags: analysisData.safety_flags,
    });

    setIsSaving(false);

    if (result.error) {
      setAnalysisError(result.error);
    } else {
      setSaveSuccess(true);
    }
  }, [analysisData, transcript]);

  const handleReset = useCallback(() => {
    setTranscript("");
    setTranscriptError(null);
    setAnalysisData(null);
    setAnalysisError(null);
    setSaveSuccess(false);
    setDuration(0);
    setFileSize("0 KB");
    setRecordError(null);
    setAgentSteps(INITIAL_STEPS);
  }, []);

  useEffect(() => {
    return () => {
      stopTimer();
      cleanupStream();
    };
  }, [stopTimer, cleanupStream]);

  const isAnalyzing = agentSteps[1].status === "running";
  const isGenerating = agentSteps[2].status === "running";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-medical shadow-lg shadow-primary/20">
              <HeartPulse className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground leading-tight">
                MediScribe AI
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                AI Clinical Documentation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs text-success font-medium">System Online</span>
            </div>
            <Link
              href="/notes"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50 hover:bg-muted text-sm font-medium text-foreground transition-colors"
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Agent Status Bar */}
      <div className="border-b border-border bg-card/30">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
          <AgentStatusBar steps={agentSteps} />
        </div>
      </div>

      {/* Main 3-Panel Layout */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-220px)] min-h-[500px]">
          {/* Panel 1: Transcript */}
          <div className="flex flex-col rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-4 border-b border-border">
              <RecordButton
                isRecording={isRecording}
                isProcessing={isProcessing}
                duration={duration}
                fileSize={fileSize}
                onToggle={isRecording ? handleStopRecording : handleStartRecording}
                error={recordError}
              />
            </div>
            <div className="flex-1 min-h-0">
              <TranscriptPanel
                transcript={transcript}
                isTranscribing={isProcessing}
                error={transcriptError}
              />
            </div>
          </div>

          {/* Panel 2: Entities */}
          <div className="flex flex-col rounded-xl border border-border bg-card overflow-hidden">
            <EntitiesPanel
              entities={analysisData?.entities || null}
              isAnalyzing={isAnalyzing}
              error={analysisError}
            />
          </div>

          {/* Panel 3: SOAP Note */}
          <div className="flex flex-col rounded-xl border border-border bg-card overflow-hidden">
            <SOAPNotePanel
              soapNote={analysisData?.soap_note || null}
              safetyFlags={analysisData?.safety_flags || []}
              isGenerating={isGenerating}
              error={analysisError}
              onSave={handleSave}
              isSaving={isSaving}
              saveSuccess={saveSuccess}
            />
          </div>
        </div>

        {/* Reset button */}
        {(transcript || analysisData) && !isProcessing && !isAnalyzing && !isGenerating && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              Start New Session
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-3">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 flex items-center justify-center gap-2">
          <Activity className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            MediScribe AI — Not a substitute for professional clinical judgment
          </p>
        </div>
      </footer>
    </div>
  );
}
