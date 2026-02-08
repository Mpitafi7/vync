/** Supabase DB types for Vync flow. Schema must match video_analyses table and Edge Function writes. */

export type VideoStatus = "processing" | "completed" | "failed";

export interface VideoRow {
  id: string;
  storage_path: string;
  status: VideoStatus;
  created_at: string;
}

/** video_analyses table columns. */
export interface VideoAnalysisRow {
  id: string;
  video_id: string;
  summary: string | null;
  thought_trace: string[] | null;
  chapters: { title: string; start_seconds: number; end_seconds?: number }[] | null;
  key_insights: KeyInsightItem[] | null;
  timeline_data?: { position: number; label: string; type: string }[] | null;
  diagram_data?: { time_seconds: number; label: string; description: string }[] | null;
}

export interface KeyInsightItem {
  timestamp: number;
  importance: number;
  text: string;
}

/** UI payload from DB / Gemini. */
export interface GeminiAnalysisPayload {
  summary?: string;
  thought_trace?: string[];
  chapters?: { title: string; start_seconds: number; end_seconds?: number }[];
  key_insights?: (string | KeyInsightItem)[];
  timeline_data?: { position: number; label: string; type: string }[];
  diagram_data?: { time_seconds: number; label: string; description: string }[];
  timelineMarkers?: { position: number; label: string; type: string }[];
  consoleLogs?: { type: string; message: string; timestamp: string }[];
  criticalPoints?: {
    time: string;
    frame: number;
    title: string;
    description: string;
    severity: string;
  }[];
  summaryMetrics?: { label: string; value: string }[];
}
