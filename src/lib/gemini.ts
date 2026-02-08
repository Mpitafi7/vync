import { env } from "./env";
import type { AnalysisResult } from "@/types/analysis";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const MAX_INLINE_BYTES = 20 * 1024 * 1024; // 20MB for inline video

const ANALYSIS_PROMPT = `You are a video intelligence engine. Analyze this video and return a single JSON object (no markdown, no code fence) with this exact structure:

{
  "rawSummary": "2-3 sentence overall summary of the video",
  "timelineMarkers": [
    { "position": 10, "label": "short label", "type": "primary" | "warning" | "accent" }
  ],
  "consoleLogs": [
    { "type": "system" | "reasoning" | "status" | "warning" | "data", "message": "log message", "timestamp": "00:00.123" }
  ],
  "criticalPoints": [
    { "time": "0:12", "frame": 360, "title": "Title", "description": "Description.", "severity": "info" | "warning" | "critical" }
  ],
  "summaryMetrics": [
    { "label": "Metric name", "value": "value" }
  ]
}

Rules: position 0-60 (timeline %). Include 4-8 timelineMarkers, 6-12 consoleLogs (ordered by timestamp), 3-6 criticalPoints with timestamps, 4-6 summaryMetrics (e.g. Total Frames, Objects/Scenes, Key moments). Types must be exactly as shown. Return only the JSON object.`;

function getMimeType(file: File): string {
  return file.type || "video/mp4";
}

export async function analyzeVideoWithGemini(file: File): Promise<AnalysisResult> {
  const apiKey = env.gemini.apiKey;
  if (!apiKey) {
    return Promise.reject(
      new Error("Video analysis runs via Supabase Edge Function (webhook). VITE_GEMINI_API_KEY is not used by the frontend.")
    );
  }

  if (file.size > MAX_INLINE_BYTES) {
    throw new Error("Video is too large for inline analysis (max 20MB). Use a shorter or smaller file.");
  }

  const base64 = await fileToBase64(file);
  const mimeType = getMimeType(file);

  const body = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: mimeType, data: base64 } },
          { text: ANALYSIS_PROMPT },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  };

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

  if (!text) throw new Error("Gemini returned no content.");

  let jsonStr = text;
  const codeMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeMatch) jsonStr = codeMatch[1].trim();
  else {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}") + 1;
    if (start >= 0 && end > start) jsonStr = text.slice(start, end);
  }
  const parsed = JSON.parse(jsonStr) as AnalysisResult;
  if (!parsed.consoleLogs) parsed.consoleLogs = [];
  if (!parsed.timelineMarkers) parsed.timelineMarkers = [];
  if (!parsed.criticalPoints) parsed.criticalPoints = [];
  if (!parsed.summaryMetrics) parsed.summaryMetrics = [];
  return parsed;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
