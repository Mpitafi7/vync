/** Analysis result from Gemini — used by Timeline, Console, EvidenceGrid */

export type LogType = "system" | "reasoning" | "status" | "warning" | "data";

export interface LogEntry {
  type: LogType;
  message: string;
  timestamp: string;
}

export interface TimelineMarker {
  position: number;
  label: string;
  type: "primary" | "warning" | "accent";
}

export interface CriticalPoint {
  time: string;
  frame: number;
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
}

export interface SummaryMetric {
  label: string;
  value: string;
}

export interface AnalysisResult {
  timelineMarkers: TimelineMarker[];
  heatmapData?: number[];
  consoleLogs: LogEntry[];
  criticalPoints: CriticalPoint[];
  summaryMetrics: SummaryMetric[];
  /** Main summary text (from video_analyses.summary) */
  rawSummary?: string;
}
