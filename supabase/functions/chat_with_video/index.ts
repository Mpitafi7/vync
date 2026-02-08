// Vync: Chat with video analysis. Invoked from frontend with question + analysis context.
// GEMINI_API_KEY: set in Dashboard → Edge Functions → chat_with_video → Secrets.
/// <reference path="./deno.d.ts" />

const GEMINI_GENERATE = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const SYSTEM_PROMPT = `You are Vync AI. Answer the user's question based ONLY on the provided video analysis data. If the data doesn't mention the answer, say you need more visual reasoning time.`;

interface RequestBody {
  question: string;
  summary: string;
  thought_trace: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY not set" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return new Response(JSON.stringify({ error: "question is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const summary = typeof body.summary === "string" ? body.summary : "";
  const thought_trace = Array.isArray(body.thought_trace) ? body.thought_trace : [];
  const contextText = [
    "--- Video analysis ---",
    "Summary: " + summary,
    "Thought trace:",
    ...thought_trace.map((s, i) => `${i + 1}. ${String(s)}`),
    "--- End of analysis ---",
  ].join("\n");

  try {
    const res = await fetch(GEMINI_GENERATE + "?key=" + geminiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT + "\n\nUse this video analysis data only:\n" + contextText }],
        },
        contents: [{ role: "user", parts: [{ text: question }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Gemini chat error:", res.status, errText);
      return new Response(
        JSON.stringify({ error: "Gemini request failed", detail: errText.slice(0, 500) }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ??
      "I couldn't generate a reply. Please try again.";

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    console.error("chat_with_video error:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ error: "Chat failed", detail: msg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
