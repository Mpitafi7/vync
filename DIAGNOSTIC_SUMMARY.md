# Vync — 400 Bad Request / Stuck on "Performing High-Reasoning Scan" — Diagnostic Summary

*For senior architect review. Copy-paste ready.*

---

## 1. Schema Mismatch Check

**What the frontend requests from `video_analyses`:**

The code in **AnalysisView.tsx** fetches **only** these columns (no `technical_summary`, no `analysis_data`):

| Location | Exact `.select()` argument |
|----------|----------------------------|
| Main effect `fetchOnce` (line ~204) | `"id, video_id, summary, thought_trace, chapters, key_insights"` |
| `AnalysisViewWithConsole` initial fetch (line ~461) | `"id, video_id, summary, thought_trace, chapters, key_insights"` |

**Explicit list of columns requested:**
- `id`
- `video_id`
- `summary`
- `thought_trace`
- `chapters`
- `key_insights`

**Not requested:** `technical_summary`, `analysis_data`, or any other column.

**Conclusion:** If the 400 persists, the **database table** likely does not have one or more of the above columns (e.g. table still has `analysis_data` or `technical_summary` instead of `summary`). The frontend is **not** asking for `technical_summary`.

---

## 2. State Logic — When Does "Scan" Change to "Results Display"?

**Relevant state:**
- `loading` (boolean): true while waiting for analysis.
- `payload` (GeminiAnalysisPayload | null): set when we have a row from `video_analyses`.
- `progressStep` (0, 1, or 2): which of the three steps is shown.
- `videoStatus`: from `videos.status` (e.g. `"processing"`, `"completed"`, `"failed"`).

**Step labels (PROGRESS_STEPS):**
1. Step 0: "Video secured in vault..."
2. Step 1: "Transferring to Gemini Engine..."
3. Step 2: "Performing High-Reasoning Scan..."

**When the stepped progress is shown:**
- Condition: `loading && !payload` (line ~294).
- So: "Performing High-Reasoning Scan" (and the whole stepped UI) is shown whenever `loading === true` and `payload === null`.

**When step index advances:**
- Every **8 seconds** (STEP_INTERVAL_MS = 8000), while:
  - `loading === true`
  - `payload` is falsy
  - `videoStatus !== "failed"`
- Code (lines ~283–289): `setProgressStep((s) => (s < PROGRESS_STEPS.length - 1 ? s + 1 : s))` so step goes 0 → 1 → 2 and then stays at 2.

**Exact condition that switches from "Scan" to "Results Display":**
- `applyResult(data)` is called with non-null `data` (a valid payload from `video_analyses`).
- That happens when:
  - `setInternalPayload(data)` runs,
  - `setError(null)` runs,
  - **`setLoading(false)`** runs (line ~145).
- So the transition to Results happens when: **we receive a row from `video_analyses` (via Realtime or polling) and map it to a payload via `rowToPayload()`**. After that, `loading` is false and the component renders the results view instead of `SteppedProgressIndicator`.

**Summary:** Transition occurs only when a successful fetch (or Realtime event) returns a `video_analyses` row with at least `id` or `video_id`; then `rowToPayload()` builds the payload and `applyResult()` sets `loading = false`. If every fetch returns 400, we never get a row, so we never call `applyResult()`, and the UI stays on "Performing High-Reasoning Scan".

---

## 3. The 400 Error Trace — Exact Request to Supabase

The Supabase client is used as:

```ts
supabase
  .from("video_analyses")
  .select("id, video_id, summary, thought_trace, chapters, key_insights")
  .eq("video_id", videoId)
  .maybeSingle();
```

**Equivalent REST call (PostgREST):**

- **Method:** `GET`
- **Base URL:** `{VITE_SUPABASE_URL}/rest/v1/video_analyses`
- **Query string (exact):**
  - `select=id,video_id,summary,thought_trace,chapters,key_insights`
  - `video_id=eq.{videoId}`  (where `{videoId}` is the UUID of the current video)
- **Headers:** `apikey: {VITE_SUPABASE_ANON_KEY}`, `Authorization: Bearer {VITE_SUPABASE_ANON_KEY}`, `Content-Type: application/json`, and typically `Prefer: return=representation` (for single-row response).

**Full URL shape:**
```
GET {VITE_SUPABASE_URL}/rest/v1/video_analyses?select=id%2Cvideo_id%2Csummary%2Cthought_trace%2Cchapters%2Ckey_insights&video_id=eq.{UUID}
```

(URL-encoded, the select value is `id,video_id,summary,thought_trace,chapters,key_insights`.)

**Why 400 can happen:** PostgREST returns 400 when the requested columns do not exist on the table (e.g. table has `technical_summary` but the request asks for `summary`), or when the filter/query is invalid. So the **table schema** must include exactly: `id`, `video_id`, `summary`, `thought_trace`, `chapters`, `key_insights` (types as used by the app: uuid, uuid, text, jsonb, jsonb, jsonb or equivalent).

---

## 4. Edge Function Payload — Exact Keys Written to the Database

**File:** `supabase/functions/analysis_trigger/index.ts`

**Insert/upsert call (lines ~195–198):**

```ts
await supabase.from("video_analyses").upsert(
  { video_id: videoId, summary, thought_trace, chapters, key_insights },
  { onConflict: "video_id" }
);
```

**Exact key names written to `video_analyses`:**
- `video_id`
- `summary`
- `thought_trace`
- `chapters`
- `key_insights`

**Where these values come from (Gemini JSON):**
- `summary`: from `parsed.summary`; if missing, falls back to `parsed.technical_summary`, then `parsed.rawSummary` (line ~189).
- `thought_trace`: from `parsed.thought_trace` (array).
- `chapters`: from `parsed.chapters` (array).
- `key_insights`: from `parsed.key_insights` (array).

The Edge Function does **not** write `analysis_data` or `technical_summary` as column names. So the **table** must have columns `summary`, `thought_trace`, `chapters`, `key_insights` (and `video_id`, `id` per schema). If the table still has only `analysis_data`, the Edge Function will also fail or behave incorrectly until the schema is aligned.

---

## 5. Realtime vs Polling — Does Polling Keep Running After a 400?

**Realtime:**
- Subscribes to `video_analyses` INSERT/UPDATE with filter `video_id=eq.{videoId}`.
- On event, builds payload with `rowToPayload(p.new)` and calls `applyResult(payload)`.
- No direct HTTP fetch; 400 does not apply here.

**Polling:**
- Runs every **5 seconds** (POLL_INTERVAL_MS = 5000) via `setInterval` (lines ~264–272).
- Each tick: calls `fetchOnce(false)` then, if no payload, `fetchVideoStatus()`.
- **On 400:** `fetchOnce` detects `is400` (code or message), logs with `console.warn`, **does not** call `setError()` or `setLoading(false)`, and returns `null`. So the interval callback does not throw and does not set error state.
- **Try/catch:** The interval callback is wrapped in try/catch; any thrown error is swallowed so the interval is not cleared.
- **Initial fetch:** `fetchOnce(true)` is used once on mount; if it returns 400, we still don’t set error (because `is400` is true), so we only set `loading(true)` and rely on polling.

**Conclusion:** Polling is **designed** to keep running after a 400: it does not set error, does not stop the interval, and does not throw. So the 400 should **not** crash the polling loop. If the UI is stuck, it’s because no successful response ever returns a row (e.g. 400 on every poll, or Realtime not firing), so `applyResult()` is never called and `loading` stays true.

**Recommendation:** In the browser Network tab, confirm that the `video_analyses` request returns 400 and inspect the response body (PostgREST error message). Then in Supabase (Table Editor or SQL), confirm that `video_analyses` has columns exactly: `id`, `video_id`, `summary`, `thought_trace`, `chapters`, `key_insights`. If any name or type differs, fix the schema or the select/upsert to match.

---

## Quick Reference

| Item | Value |
|------|--------|
| Columns requested in frontend | `id`, `video_id`, `summary`, `thought_trace`, `chapters`, `key_insights` |
| Columns written by Edge Function | `video_id`, `summary`, `thought_trace`, `chapters`, `key_insights` |
| Step interval | 8 s |
| Poll interval | 5 s |
| Transition to results | First successful fetch/Realtime that yields a payload and calls `applyResult()` → `setLoading(false)` |
| 400 handling | Logged; no `setError`, no `setLoading(false)`; polling continues |
