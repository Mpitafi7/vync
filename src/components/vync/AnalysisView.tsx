import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { FileText, ListOrdered, Brain, Loader2, Check, Lightbulb, MessageCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { GeminiAnalysisPayload, VideoAnalysisRow, KeyInsightItem } from "@/types/database";
import type { AnalysisResult } from "@/types/analysis";
import VideoPlayer from "./VideoPlayer";
import IntelligenceTimeline from "./IntelligenceTimeline";
import CognitiveConsole from "./CognitiveConsole";
import EvidenceGrid from "./EvidenceGrid";
import { VideoChat } from "./VideoChat";

const PROGRESS_STEPS = [
  "Video secured in vault...",
  "Transferring to Gemini Engine...",
  "Performing High-Reasoning Scan...",
] as const;
const STEP_INTERVAL_MS = 8000;
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/** Columns to fetch from video_analyses (must match DB schema). */
const VIDEO_ANALYSES_SELECT = "id, video_id, summary, thought_trace, chapters, key_insights, timeline_data, diagram_data";

function SteppedProgressIndicator({
  currentStep,
  videoStatus,
  videoId,
}: {
  currentStep: number;
  videoStatus: string | null;
  videoId: string;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8 px-4">
      <p className="font-mono text-[10px] text-muted-foreground">
        Current ID: {videoId || "—"}
      </p>
      {videoStatus && (
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          DB status: {videoStatus}
        </p>
      )}
      <div className="w-full max-w-md space-y-4">
        {PROGRESS_STEPS.map((label, i) => {
          const active = i <= currentStep;
          const done = i < currentStep;
          return (
            <motion.div
              key={label}
              initial={{ opacity: 0.5 }}
              animate={{ opacity: active ? 1 : 0.5 }}
              className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/40 px-4 py-3"
            >
              {done ? (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                  <Check className="h-4 w-4" />
                </div>
              ) : (
                <div
                  className={`h-8 w-8 shrink-0 rounded-full border-2 ${
                    i === currentStep
                      ? "border-primary bg-primary/10"
                      : "border-muted-foreground/30 bg-muted/50"
                  }`}
                >
                  {i === currentStep && (
                    <div className="flex h-full w-full items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    </div>
                  )}
                </div>
              )}
              <span
                className={`font-mono text-sm ${
                  active ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </motion.div>
          );
        })}
      </div>
      <p className="font-mono text-xs text-muted-foreground">
        Realtime + 3s polling. No manual invoke — webhook triggers analysis.
      </p>
    </div>
  );
}

function ensureArray<T>(val: unknown): T[] {
  if (Array.isArray(val)) return val as T[];
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val) as unknown;
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function ensureString(val: unknown): string {
  if (typeof val === "string") return val;
  if (val == null) return "";
  return String(val);
}

function ensureKeyInsights(val: unknown): (string | KeyInsightItem)[] {
  if (!Array.isArray(val)) return [];
  return val.map((item) => {
    if (item != null && typeof item === "object" && "text" in item) return item as KeyInsightItem;
    return typeof item === "string" ? item : String(item);
  });
}

/** Map DB row to UI payload. Sanitizes JSON columns; maps timeline_data → timelineMarkers. */
function rowToPayload(row: Partial<VideoAnalysisRow> | null): GeminiAnalysisPayload | null {
  if (!row || (row.id == null && row.video_id == null)) return null;
  const timelineData = ensureArray<{ position: number; label: string; type: string }>(row.timeline_data);
  const diagramData = ensureArray<{ time_seconds: number; label: string; description: string }>(row.diagram_data);
  return {
    summary: ensureString(row.summary) || undefined,
    thought_trace: ensureArray<string>(row.thought_trace),
    chapters: ensureArray<{ title: string; start_seconds: number; end_seconds?: number }>(row.chapters),
    key_insights: ensureKeyInsights(row.key_insights),
    timeline_data: timelineData.length ? timelineData : undefined,
    diagram_data: diagramData.length ? diagramData : undefined,
    timelineMarkers: timelineData.length ? timelineData : [],
    consoleLogs: [],
    criticalPoints: [],
    summaryMetrics: [],
  };
}

function payloadToAnalysis(p: GeminiAnalysisPayload): AnalysisResult {
  const timelineMarkers = (p.timeline_data?.length ? p.timeline_data : p.timelineMarkers) ?? [];
  return {
    timelineMarkers: timelineMarkers.map((m) => ({ position: m.position, label: m.label, type: (m.type || "primary") as "primary" | "warning" | "accent" })),
    consoleLogs: (p.consoleLogs ?? []).map((l) => ({
      type: (l.type as AnalysisResult["consoleLogs"][0]["type"]) || "data",
      message: l.message,
      timestamp: l.timestamp,
    })),
    criticalPoints: (p.criticalPoints ?? []).map((c) => ({
      time: c.time,
      frame: c.frame,
      title: c.title,
      description: c.description,
      severity: (c.severity as "info" | "warning" | "critical") || "info",
    })),
    summaryMetrics: p.summaryMetrics ?? [],
    rawSummary: p.summary,
  };
}

interface AnalysisViewProps {
  videoId: string;
  publicUrl: string;
  /** When provided, parent drives state (e.g. from Realtime); otherwise this component subscribes itself */
  payload?: GeminiAnalysisPayload | null;
}

export default function AnalysisView({ videoId: videoIdProp, publicUrl, payload: payloadProp }: AnalysisViewProps) {
  const videoId = String(videoIdProp ?? "").trim();

  const [internalPayload, setInternalPayload] = useState<GeminiAnalysisPayload | null>(null);
  const [loading, setLoading] = useState(!payloadProp);
  const [error, setError] = useState<string | null>(null);
  const [progressStep, setProgressStep] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartTimeRef = useRef<number>(0);

  const [fallbackVideoId, setFallbackVideoId] = useState<string | null>(null);
  const payload = payloadProp !== undefined ? payloadProp : internalPayload;

  const [videoStatus, setVideoStatus] = useState<string | null>("processing");

  useEffect(() => {
    setInternalPayload(null);
    setError(null);
    setLoading(payloadProp == null);
    setVideoStatus("processing");
    setProgressStep(0);
    setFallbackVideoId(null);
  }, [videoId]);

  useEffect(() => {
    if (payloadProp !== undefined || !videoId) return;

    const applyResult = (data: GeminiAnalysisPayload | null, fromFallbackVideoId?: string) => {
      if (!data) return;
      setInternalPayload(data);
      setError(null);
      setLoading(false);
      if (fromFallbackVideoId) setFallbackVideoId(fromFallbackVideoId);
    };

    const channelName = "video_analysis_" + videoId + "_" + Date.now();
    const channelAnalysis = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "video_analyses",
          filter: `video_id=eq.${videoId}`,
        },
        (p) => {
          const payload = rowToPayload(p.new as Partial<VideoAnalysisRow>);
          if (payload) applyResult(payload);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "video_analyses",
          filter: `video_id=eq.${videoId}`,
        },
        (p) => {
          const payload = rowToPayload(p.new as Partial<VideoAnalysisRow>);
          if (payload) applyResult(payload);
        }
      )
      .subscribe();

    const channelVideoName = "video_status_" + videoId + "_" + Date.now();
    const channelVideo = supabase
      .channel(channelVideoName)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "videos",
          filter: `id=eq.${videoId}`,
        },
        (p) => {
          const row = p.new as { status?: string };
          if (row?.status) setVideoStatus(row.status);
          if (row?.status === "failed") {
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
            setError("Analysis failed. Please try again or use a shorter video.");
            setLoading(false);
          }
        }
      )
      .subscribe();

    const fetchOnce = async (setErrorOnFail = true): Promise<GeminiAnalysisPayload | null> => {
      console.log("[Vync] Polling for video_id:", videoId);
      try {
        const { data, error: e } = await supabase
          .from("video_analyses")
          .select(VIDEO_ANALYSES_SELECT)
          .eq("video_id", videoId)
          .maybeSingle();
        if (e) {
          const is400 = e.code === "PGRST301" || e.message?.includes("400") || e.message?.toLowerCase().includes("bad request");
          if (is400) {
            console.warn("[Vync] video_analyses fetch 400 (table may be empty):", e.message);
          } else {
            console.warn("[Vync] video_analyses fetch error:", e.message, e.code);
          }
          if (setErrorOnFail && !is400) {
            setError(e.message);
            setLoading(false);
          }
          return null;
        }
        const payload = rowToPayload(data as Partial<VideoAnalysisRow> | null);
        if (payload) {
          console.log("[Vync] Row found for video_id:", videoId, "→ showing dashboard");
        } else {
          console.log("[Vync] No row in video_analyses for video_id:", videoId, "(Gemini may still be running or Edge Function failed)");
        }
        return payload;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[Vync] video_analyses fetch exception:", msg);
        if (setErrorOnFail) {
          setError(msg);
          setLoading(false);
        }
        return null;
      }
    };

    const fetchVideoStatus = async () => {
      try {
        const { data, error: e } = await supabase
          .from("videos")
          .select("status")
          .eq("id", videoId)
          .maybeSingle();
        if (e) {
          console.warn("[Vync] videos status fetch error:", e.message);
          return;
        }
        if (data?.status) setVideoStatus(data.status);
        if (data?.status === "failed") {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          setError("Analysis failed. Please try again or use a shorter video.");
          setLoading(false);
        }
      } catch (err) {
        console.warn("[Vync] videos status fetch exception:", err instanceof Error ? err.message : err);
      }
    };

    const fetchLatestAnalysis = async (): Promise<boolean> => {
      try {
        const { data, error: e } = await supabase
          .from("video_analyses")
          .select(VIDEO_ANALYSES_SELECT)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (e || !data) {
          console.warn("[Vync] Fallback: no latest row", e?.message);
          return false;
        }
        const row = data as Partial<VideoAnalysisRow> & { video_id?: string };
        const payload = rowToPayload(row);
        if (payload && row.video_id) {
          console.log("[Vync] Fallback: showing latest analysis for video_id:", row.video_id);
          applyResult(payload, row.video_id);
          return true;
        }
      } catch (err) {
        console.warn("[Vync] Fallback fetch exception:", err instanceof Error ? err.message : err);
      }
      return false;
    };

    fetchVideoStatus();

    pollStartTimeRef.current = Date.now();

    const runPoll = () => {
      if (Date.now() - pollStartTimeRef.current > MAX_POLL_TIMEOUT_MS) {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        setError("Analysis is taking longer than expected (5 min). Please try again or use a shorter video.");
        setLoading(false);
        return;
      }
      fetchOnce(false).then((payload) => {
        if (payload) {
          applyResult(payload);
        } else {
          fetchLatestAnalysis().then((used) => {
            if (!used) fetchVideoStatus();
          });
        }
      });
    };

    runPoll();
    fetchOnce(true).then((payload) => {
      if (payload) applyResult(payload);
      else {
        setLoading(true);
        fetchLatestAnalysis().then((used) => {
          if (!used) {}
        });
      }
    });

    pollRef.current = setInterval(runPoll, POLL_INTERVAL_MS);

    const earlyPollTimer = setTimeout(runPoll, 1000);

    return () => {
      clearTimeout(earlyPollTimer);
      supabase.removeChannel(channelAnalysis);
      supabase.removeChannel(channelVideo);
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [videoId, payloadProp]);

  // Stepped progress: advance step every STEP_INTERVAL_MS while loading; driven by DB status (we show steps only when status = processing)
  useEffect(() => {
    if (!loading || payload || videoStatus === "failed") return;
    const t = setInterval(() => {
      setProgressStep((s) => (s < PROGRESS_STEPS.length - 1 ? s + 1 : s));
    }, STEP_INTERVAL_MS);
    return () => clearInterval(t);
  }, [loading, payload, videoStatus]);

  const analysis = payload ? payloadToAnalysis(payload) : null;
  const chapters = Array.isArray(payload?.chapters) ? (payload?.chapters ?? []) : ensureArray<{ title: string; start_seconds: number; end_seconds?: number }>(payload?.chapters);
  const thoughtTrace = Array.isArray(payload?.thought_trace) ? (payload?.thought_trace ?? []) : ensureArray<string>(payload?.thought_trace);
  const keyInsights = Array.isArray(payload?.key_insights) ? (payload?.key_insights ?? []) : ensureArray<string>(payload?.key_insights);
  const summaryText = typeof payload?.summary === "string" ? payload.summary : ensureString(payload?.summary);

  if (payload) {
    const displayId = fallbackVideoId ?? videoId;
    console.log("[Vync] Displaying data for ID:", displayId);
    return (
    <div className="mx-auto max-w-5xl space-y-6">
      <p className="font-mono text-[10px] text-muted-foreground">
        Current ID: {videoId}
        {fallbackVideoId && (
          <span className="ml-2 text-amber-600 dark:text-amber-400">(showing latest for: {fallbackVideoId})</span>
        )}
      </p>
      {publicUrl ? (
        <VideoPlayer src={publicUrl} />
      ) : (
        <div className="glass rounded-xl aspect-video flex items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="font-mono text-sm text-muted-foreground">Uploading video…</span>
        </div>
      )}

      {/* Summary: from DB column summary via rowToPayload → payload.summary */}
      {summaryText && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-5"
        >
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h3 className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Summary
            </h3>
          </div>
          <p className="font-mono text-sm text-foreground/90 leading-relaxed">{summaryText}</p>
        </motion.section>
      )}

      {Array.isArray(keyInsights) && keyInsights.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-5"
        >
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            <h3 className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Key Insights
            </h3>
          </div>
          <ul className="list-disc list-inside space-y-1 font-mono text-sm text-foreground/90">
            {keyInsights.map((insight, i) => (
              <li key={i} className="leading-relaxed">
                {typeof insight === "string" ? insight : (insight && typeof insight === "object" && "text" in insight ? (insight as KeyInsightItem).text : String(insight))}
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      {Array.isArray(chapters) && chapters.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-5"
        >
          <div className="mb-3 flex items-center gap-2">
            <ListOrdered className="h-4 w-4 text-accent" />
            <h3 className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Chapters
            </h3>
          </div>
          <ul className="space-y-2">
            {chapters.map((ch, i) => (
              <li key={i} className="flex items-center gap-3 font-mono text-sm">
                <span className="text-muted-foreground tabular-nums">
                  {formatTime(ch?.start_seconds ?? 0)}
                  {ch?.end_seconds != null ? ` – ${formatTime(ch.end_seconds)}` : ""}
                </span>
                <span className="text-foreground">{ch?.title ?? ""}</span>
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      {Array.isArray(thoughtTrace) && thoughtTrace.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-5"
        >
          <div className="mb-3 flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <h3 className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Thought Trace
            </h3>
          </div>
          <ol className="list-decimal list-inside space-y-2 font-mono text-xs text-foreground/80">
            {thoughtTrace.map((step, i) => (
              <li key={i} className="leading-relaxed">{typeof step === "string" ? step : String(step)}</li>
            ))}
          </ol>
        </motion.section>
      )}

      <IntelligenceTimeline
        markers={analysis?.timelineMarkers}
        heatmapData={analysis?.heatmapData}
      />
      <EvidenceGrid
        criticalPoints={analysis?.criticalPoints}
        summaryMetrics={analysis?.summaryMetrics}
        diagramData={payload.diagram_data}
      />
    </div>
    );
  }

  if (videoStatus === "failed") {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 space-y-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
          <div>
            <p className="font-mono text-sm font-medium text-destructive">
              {error || "Analysis failed. Please try again or use a shorter video."}
            </p>
            <p className="font-mono text-xs text-muted-foreground mt-2">
              Try again with a shorter video or check your connection. If it keeps failing, the file may be too large or in an unsupported format.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
        <p className="font-mono text-sm text-destructive">Error: {error}</p>
      </div>
    );
  }

  return (
    <SteppedProgressIndicator
      currentStep={progressStep}
      videoStatus={videoStatus}
      videoId={videoId}
    />
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AnalysisViewWithConsole({
  videoId,
  publicUrl,
}: {
  videoId: string;
  publicUrl: string;
}) {
  const [payload, setPayload] = useState<GeminiAnalysisPayload | null>(null);
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel("video_analysis_console_" + videoId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "video_analyses",
          filter: `video_id=eq.${videoId}`,
        },
        (p) => {
          const payload = rowToPayload(p.new as Partial<VideoAnalysisRow>);
          if (payload) setPayload(payload);
        }
      )
      .subscribe();

    (async () => {
      try {
        const { data, error: e } = await supabase
          .from("video_analyses")
          .select(VIDEO_ANALYSES_SELECT)
          .eq("video_id", videoId)
          .maybeSingle();
        if (e) {
          console.warn("[Vync] AnalysisViewWithConsole video_analyses fetch:", e.message, e.code);
          return;
        }
        const payload = rowToPayload(data as Partial<VideoAnalysisRow> | null);
        if (payload) setPayload(payload);
      } catch (err) {
        console.warn("[Vync] AnalysisViewWithConsole fetch exception:", err instanceof Error ? err.message : err);
      }
    })();

    return () => { supabase.removeChannel(channel); };
  }, [videoId]);

  const analysis = payload ? payloadToAnalysis(payload) : null;

  return (
    <>
      <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
        <AnalysisView videoId={videoId} publicUrl={publicUrl} payload={payload} />
      </main>
      <aside className="hidden lg:flex lg:w-[380px] lg:shrink-0 lg:flex-col lg:border-l lg:border-border lg:overflow-hidden">
        {showChat ? (
          <VideoChat
            videoId={videoId}
            open={true}
            onClose={() => setShowChat(false)}
          />
        ) : (
          <>
            <div className="flex justify-end px-2 py-1.5 border-b border-border/50">
              <button
                type="button"
                onClick={() => setShowChat(true)}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-[10px] text-primary hover:bg-primary/10 border border-primary/30 transition-colors"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>AI Video Chat</span>
              </button>
            </div>
            <div className="flex-1 min-h-0 p-4 pt-2">
              <CognitiveConsole logs={analysis?.consoleLogs} />
            </div>
          </>
        )}
      </aside>
    </>
  );
}
