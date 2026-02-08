/// <reference path="./deno.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET = "videos";
const GEMINI_UPLOAD = "https://generativelanguage.googleapis.com/upload/v1beta/files";
const GEMINI_GENERATE = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-001:generateContent";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateVideoStatus(supabase: any, videoId: string, status: string, errorMsg?: string) {
  const updates: any = { status };
  if (errorMsg) updates.error_message = errorMsg;
  await supabase.from("videos").update(updates).eq("id", videoId);
  console.log(`✓ Video ${videoId} status: ${status}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  const startTime = Date.now();
  let videoId: string;

  try {
    const body = (await req.json()) as WebhookPayload | { video_id: string };

    if ("record" in body && body.record?.id) {
      videoId = String(body.record.id).trim();
    } else if ("video_id" in body && body.video_id) {
      videoId = String(body.video_id).trim();
    } else {
      return new Response(
        JSON.stringify({ error: "Missing video_id or webhook record" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  console.log(`🎬 Starting analysis for video: ${videoId}`);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const geminiKey = Deno.env.get("GEMINI_API_KEY");

  if (!geminiKey) {
    console.error("❌ GEMINI_API_KEY not set");
    return new Response(
      JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Step 1: Fetch video record
  const { data: video, error: videoError } = await supabase
    .from("videos")
    .select("id, storage_path")
    .eq("id", videoId)
    .single();

  if (videoError || !video?.storage_path) {
    console.error("❌ Video not found:", videoError);
    return new Response(
      JSON.stringify({ error: "Video not found or no storage_path" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  await updateVideoStatus(supabase, videoId, "processing");

  // Step 2: Download video from storage
  console.log(`📥 Downloading video from storage: ${video.storage_path}`);

  const { data: blob, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(video.storage_path);

  if (downloadError || !blob) {
    console.error("❌ Download failed:", downloadError);
    await updateVideoStatus(supabase, videoId, "failed", "Failed to download video");
    return new Response(
      JSON.stringify({ error: "Failed to download video from storage" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const mimeType = blob.type || "video/mp4";
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const numBytes = bytes.length;

  console.log(`📊 Video size: ${(numBytes / 1024 / 1024).toFixed(2)} MB`);

  // Step 3: Upload to Gemini (with timeout protection)
  console.log("🚀 Uploading to Gemini File API...");

  let uploadUrl: string | null = null;

  try {
    const startRes = await fetch(GEMINI_UPLOAD + "?key=" + geminiKey, {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(numBytes),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file: { display_name: `vync_${video.storage_path}` },
      }),
    });

    uploadUrl = startRes.headers.get("x-goog-upload-url");

    if (!uploadUrl) {
      throw new Error("No upload URL from Gemini");
    }
  } catch (err) {
    console.error("❌ Gemini upload start failed:", err);
    await updateVideoStatus(supabase, videoId, "failed", "Gemini upload initialization failed");
    return new Response(
      JSON.stringify({ error: "Gemini upload start failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let fileUri: string | null = null;

  try {
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
      const errorText = await uploadRes.text();
      throw new Error(`Upload failed: ${errorText}`);
    }

    const fileInfo = await uploadRes.json();
    fileUri = fileInfo?.file?.uri;

    if (!fileUri) {
      throw new Error("No file URI from Gemini response");
    }

    console.log(`✓ Uploaded to Gemini: ${fileUri}`);
  } catch (err) {
    console.error("❌ Gemini file upload failed:", err);
    await updateVideoStatus(supabase, videoId, "failed", "Gemini file upload failed");
    return new Response(
      JSON.stringify({ error: "Gemini file upload failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Step 4: Generate analysis
  console.log("🧠 Requesting Gemini analysis...");

  const analysisData: {
    summary: string;
    thought_trace: string[];
    chapters: unknown[];
    key_insights: unknown[];
    timeline_data: unknown[];
    diagram_data: unknown[];
  } = {
    summary: "",
    thought_trace: [],
    chapters: [],
    key_insights: [],
    timeline_data: [],
    diagram_data: [],
  };

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
      throw new Error(`Gemini generate failed: ${errText}`);
    }

    const genData = await generateRes.json();
    const responseText = (genData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();

    if (!responseText) {
      throw new Error("Empty response from Gemini");
    }

    console.log(`✓ Gemini response received (${responseText.length} chars)`);

    // Parse JSON
    let jsonStr = responseText;
    const codeMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);

    if (codeMatch) {
      jsonStr = codeMatch[1].trim();
    } else {
      const start = responseText.indexOf("{");
      const end = responseText.lastIndexOf("}") + 1;
      if (start >= 0 && end > start) {
        jsonStr = responseText.slice(start, end);
      }
    }

    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    analysisData.summary = typeof parsed.summary === "string" ? parsed.summary : "";
    analysisData.thought_trace = Array.isArray(parsed.thought_trace) ? (parsed.thought_trace as string[]) : [];
    analysisData.chapters = Array.isArray(parsed.chapters) ? parsed.chapters : [];

    // Process key_insights
    const rawKeyInsights = parsed.key_insights;
    if (Array.isArray(rawKeyInsights)) {
      analysisData.key_insights = rawKeyInsights.map((item: unknown) => {
        if (item != null && typeof item === "object" && "timestamp" in item && "importance" in item) {
          const o = item as { timestamp: number; importance: number; text?: string };
          return { timestamp: o.timestamp, importance: o.importance, text: String(o.text ?? "") };
        }
        return { timestamp: 0, importance: 5, text: typeof item === "string" ? item : String(item) };
      });
    }

    analysisData.timeline_data = Array.isArray(parsed.timeline_data) ? parsed.timeline_data : [];
    analysisData.diagram_data = Array.isArray(parsed.diagram_data) ? parsed.diagram_data : [];

    console.log("✓ Analysis parsed successfully");
  } catch (err) {
    console.error("❌ Gemini analysis failed:", err);
    await updateVideoStatus(supabase, videoId, "failed", "Gemini analysis failed");

    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: "Gemini analysis failed", detail: msg }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  // Step 5: Save to database
  console.log("💾 Saving analysis to database...");

  try {
    const { error: insertError } = await supabase
      .from("video_analyses")
      .upsert(
        {
          video_id: videoId,
          ...analysisData,
        },
        { onConflict: "video_id" }
      );

    if (insertError) {
      throw insertError;
    }

    console.log("✓ Analysis saved to database");
  } catch (err) {
    console.error("❌ Database save failed:", err);
    await updateVideoStatus(supabase, videoId, "failed", "Failed to save analysis");

    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: "Failed to save analysis", detail: msg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Step 6: Mark as completed
  await updateVideoStatus(supabase, videoId, "completed");

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ Analysis complete in ${duration}s for video: ${videoId}`);

  return new Response(
    JSON.stringify({ ok: true, video_id: videoId, duration_seconds: duration }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
});