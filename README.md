# Vync — Multimodal Video Intelligence Engine

End-to-end flow: **Upload video → Supabase Storage + DB → Edge Function → Gemini analysis → Realtime UI**.

## Architecture

1. **Ingestion:** User selects video → upload to Supabase Storage (bucket `videos`) → insert row in `videos` table (status `processing`).
2. **Bridge:** A **Supabase Database Webhook** is configured so that whenever a new row is inserted into `videos`, Supabase automatically sends a **POST** request to the `analysis_trigger` Edge Function URL. No frontend invoke — no CLI required for triggering.
3. **Brain:** Edge Function receives the webhook payload, downloads the video from Storage, uploads to Gemini File API, runs analysis; returns JSON (technical summary, chapters, thought_trace, timeline, etc.).
4. **Sync:** Edge Function saves JSON to `video_analyses` and sets `videos.status` to `completed`. The **frontend only listens** to `video_analyses` via **Supabase Realtime** and shows the Analysis Dashboard when new data arrives.

## Tech stack

- Vite, TypeScript, React, shadcn/ui, Tailwind CSS
- Supabase (Storage, DB, Realtime, Edge Functions)
- Gemini API (video analysis)
- Netlify (deployment)

## Local development

```sh
git clone <YOUR_GIT_URL>
cd vync-insight-engine
npm install
copy .env.example .env   # add VITE_SUPABASE_* and optionally VITE_GEMINI_*
npm run dev
```

## Supabase setup

### 1. Project and env

- Create a project at [supabase.com](https://supabase.com).
- **Settings → API:** copy **Project URL** and **anon public** key.
- In project root `.env`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Database

Run the migration (SQL Editor or `supabase db push`):

- `supabase/migrations/20250207000001_create_videos_tables.sql`  
  Creates `videos`, `video_analyses`, RLS, and adds `video_analyses` to Realtime.

### 3. Storage bucket

- **Storage → New bucket:** name `videos`, **Public** if you want public playback URLs (recommended for this flow).

### 4. Edge Function and Gemini key

- Deploy the function:
  ```sh
  supabase functions deploy analysis_trigger
  ```
- **Edge Functions → analysis_trigger → Secrets:** add `GEMINI_API_KEY` with your [Gemini API key](https://aistudio.google.com/apikey).

### 5. Database Webhook (required for analysis)

The frontend does **not** call the Edge Function. Supabase triggers it via a webhook when a new video is inserted.

1. In Supabase Dashboard go to **Database → Webhooks**.
2. Click **Create a new hook**.
3. **Name:** e.g. `on_video_insert`.
4. **Table:** `videos`.
5. **Events:** tick **Insert**.
6. **Type:** HTTP Request.
7. **Method:** POST.
8. **URL:** `https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/analysis_trigger`  
   Replace `<YOUR_PROJECT_REF>` with your project ref (from Settings → API, e.g. `abcdefghij` in `https://abcdefghij.supabase.co`).
9. **HTTP Headers** (optional): add `Content-Type: application/json` if needed.
10. Save. When a new row is inserted into `videos`, Supabase will POST the payload (including `record`) to the Edge Function; the function already parses `record.id` as `video_id`.

## Deploy on Netlify

1. Connect repo; build command `npm run build`, publish `dist`.
2. Add **Environment variables:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. Deploy.

## Key files

| File | Responsibility |
|------|----------------|
| `src/components/vync/VideoUpload.tsx` | Upload to Supabase Storage + progress; insert `videos` row. |
| `supabase/functions/analysis_trigger/index.ts` | Download video from Storage → Gemini File API → generate analysis → save to `video_analyses`. |
| `src/components/vync/AnalysisView.tsx` | Realtime subscribe to `video_analyses`; show Summary, Chapters, Thought Trace, Timeline, Evidence. |
