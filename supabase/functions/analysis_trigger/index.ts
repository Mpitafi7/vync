// Vync: Supabase Edge Function — triggered by Database Webhook on videos INSERT.
// Configure in Dashboard: Database → Webhooks → on videos INSERT → POST this function URL.
// GEMINI_API_KEY: set in Dashboard → Edge Functions → analysis_trigger → Secrets. Read via Deno.env.get('GEMINI_API_KEY').
// Payload: { type: 'INSERT', table: 'videos', record: { id, storage_path, ... } }. Uses record.id as video_id.
// 1. Fetch video from Storage, 2. Upload to Gemini File API, 3. Generate analysis, 4. Save to video_analyses (summary, thought_trace, chapters, key_insights).
/// <reference path="./deno.d.ts" />

import { createClient } from "@supabase/supabase-js";

const BUCKET = "videos";
const GEMINI_UPLOAD = "https://generativelanguage.googleapis.com/upload/v1beta/files";
const GEMINI_GENERATE = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const ANALYSIS_PROMPT = `You are a video intelligence engine. Analyze this video and return a single JSON object (no markdown, no code fence) with this exact structure:

{
  "summary": "2-4 sentence summary of the video content and structure.",
  "chapters": [
    { "title": "Chapter title", "start_seconds": 0, "end_seconds": 60 }
  ],
  "thought_trace": [
    "Step 1 of your reasoning...",
    "Step 2..."
  ],
  "key_insights": [
    { "timestamp": 0, "importance": 8, "text": "Key insight description." }
  ],
  "timeline_data": [
    { "position": 10, "label": "Event label", "type": "primary" }
  ],
  "diagram_data": [
    { "time_seconds": 0, "label": "Phase or event", "description": "Short description." }
  ]
}

Rules:
- summary: main text summary. chapters: title, start_seconds, end_seconds (optional). thought_trace: 4-8 reasoning steps.
- key_insights: 3-6 items. Each must be an object with "timestamp" (seconds, number), "importance" (1-10, number), and "text" (string).
- timeline_data: for Intelligence Timeline. 4-8 items. Each: "position" (0-100, number = % through video), "label" (string), "type" ("primary" | "warning" | "accent").
- diagram_data: for Temporal Flow Diagram. 3-8 items. Each: "time_seconds" (number), "label" (string), "description" (string).
Return only the JSON object.`;

interface WebhookPayload {
  type?: string;
  table?: string;
  record?: { id: string; storage_path: string; status: string };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  let videoId: string;
  try {
    const body = (await req.json()) as WebhookPayload | { video_id: string };
    if ("record" in body && body.record?.id) {
      videoId = String(body.record.id).trim();
    } else if ("video_id" in body && body.video_id) {
      videoId = String(body.video_id).trim();
    } else {
      return new Response(JSON.stringify({ error: "Missing video_id or webhook record" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  // Read from Supabase Secrets (Dashboard → Edge Functions → analysis_trigger → Secrets)
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY not set" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: video, error: videoError } = await supabase
    .from("videos")
    .select("id, storage_path")
    .eq("id", videoId)
    .single();

  if (videoError || !video?.storage_path) {
    return new Response(JSON.stringify({ error: "Video not found or no storage_path" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(video.storage_path);

  if (downloadError || !blob) {
    await supabase.from("videos").update({ status: "failed" }).eq("id", videoId);
    return new Response(JSON.stringify({ error: "Failed to download video from storage" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const mimeType = blob.type || "video/mp4";
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const numBytes = bytes.length;

  const startRes = await fetch(GEMINI_UPLOAD + "?key=" + geminiKey, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(numBytes),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: video.storage_path } }),
  });

  const uploadUrl = startRes.headers.get("x-goog-upload-url");
  if (!uploadUrl) {
    await supabase.from("videos").update({ status: "failed" }).eq("id", videoId);
    return new Response(JSON.stringify({ error: "Gemini upload start failed" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(numBytes),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: bytes,
  });

  if (!uploadRes.ok) {
    await supabase.from("videos").update({ status: "failed" }).eq("id", videoId);
    return new Response(JSON.stringify({ error: "Gemini file upload failed" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const fileInfo = await uploadRes.json();
  const fileUri = fileInfo?.file?.uri;
  if (!fileUri) {
    await supabase.from("videos").update({ status: "failed" }).eq("id", videoId);
    return new Response(JSON.stringify({ error: "No file URI from Gemini" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const videoIdUuid = UUID_REGEX.test(videoId) ? videoId : null;
  if (!videoIdUuid) {
    await supabase.from("videos").update({ status: "failed" }).eq("id", videoId);
    return new Response(JSON.stringify({ error: "Invalid video_id UUID format", videoId }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  let summary = "";
  let thought_trace: string[] = [];
  let chapters: unknown[] = [];
  let key_insights: unknown[] = [];
  let timeline_data: unknown[] = [];
  let diagram_data: unknown[] = [];

  try {
    const generateRes = await fetch(GEMINI_GENERATE + "?key=" + geminiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { file_data: { file_uri: fileUri, mime_type: mimeType } },
            { text: ANALYSIS_PROMPT },
          ],
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!generateRes.ok) {
      const errText = await generateRes.text();
      await supabase.from("videos").update({ status: "failed" }).eq("id", videoIdUuid);
      return new Response(JSON.stringify({ error: "Gemini generate failed", detail: errText }), { status: 502, headers: { "Content-Type": "application/json" } });
    }

    const genData = await generateRes.json();
    const responseText = (genData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
    console.log("Gemini raw response:", responseText);

    if (!responseText) {
      await supabase.from("videos").update({ status: "failed" }).eq("id", videoIdUuid);
      return new Response(JSON.stringify({ error: "Empty Gemini response" }), { status: 502, headers: { "Content-Type": "application/json" } });
    }

    let jsonStr = responseText;
    const codeMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeMatch) jsonStr = codeMatch[1].trim();
    else {
      const start = responseText.indexOf("{");
      const end = responseText.lastIndexOf("}") + 1;
      if (start >= 0 && end > start) jsonStr = responseText.slice(start, end);
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    } catch (parseErr) {
      const errMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      const structured = {
        error: "Gemini response is not valid JSON",
        parseError: errMsg,
        rawLength: responseText.length,
        rawPreview: responseText.slice(0, 500),
      };
      console.error("Gemini invalid JSON:", JSON.stringify(structured, null, 2));
      await supabase.from("videos").update({ status: "failed" }).eq("id", videoIdUuid);
      return new Response(JSON.stringify({ error: "Invalid JSON from Gemini", detail: structured }), { status: 502, headers: { "Content-Type": "application/json" } });
    }

    console.log("Gemini full JSON:", JSON.stringify(parsed, null, 2));

    summary = typeof parsed.summary === "string" ? parsed.summary : "";
    thought_trace = Array.isArray(parsed.thought_trace) ? (parsed.thought_trace as string[]) : [];
    chapters = Array.isArray(parsed.chapters) ? parsed.chapters : [];
    const rawKeyInsights = parsed.key_insights;
    if (Array.isArray(rawKeyInsights)) {
      key_insights = rawKeyInsights.map((item) => {
        if (item != null && typeof item === "object" && "timestamp" in item && "importance" in item) {
          return { timestamp: (item as { timestamp: number }).timestamp, importance: (item as { importance: number }).importance, text: String((item as { text?: string }).text ?? "") };
        }
        return { timestamp: 0, importance: 5, text: typeof item === "string" ? item : String(item) };
      });
    } else {
      key_insights = [];
    }
    timeline_data = Array.isArray(parsed.timeline_data) ? parsed.timeline_data : [];
    diagram_data = Array.isArray(parsed.diagram_data) ? parsed.diagram_data : [];
  } catch (geminiErr) {
    console.error("Gemini or parse error:", geminiErr);
    await supabase.from("videos").update({ status: "failed" }).eq("id", videoIdUuid);
    const msg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
    return new Response(JSON.stringify({ error: "Gemini/parse failed", detail: msg }), { status: 502, headers: { "Content-Type": "application/json" } });
  }

  console.log("Attempting DB upsert for video:", videoIdUuid);

  let insertError: { message: string } | null = null;
  try {
    const result = await supabase.from("video_analyses").upsert(
      {
        video_id: videoIdUuid,
        summary,
        thought_trace,
        chapters,
        key_insights,
        timeline_data,
        diagram_data,
      },
      { onConflict: "video_id" }
    );
    insertError = result.error;
    if (insertError) console.error("DB Insert Failed:", insertError);
  } catch (err) {
    console.error("DB Insert Failed:", err);
    insertError = err instanceof Error ? { message: err.message } : { message: String(err) };
  }

  if (insertError) {
    await supabase.from("videos").update({ status: "failed" }).eq("id", videoIdUuid);
    return new Response(JSON.stringify({ error: "Failed to save analysis", detail: insertError.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  await supabase.from("videos").update({ status: "completed" }).eq("id", videoIdUuid);

  return new Response(JSON.stringify({ ok: true, video_id: videoIdUuid }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});
