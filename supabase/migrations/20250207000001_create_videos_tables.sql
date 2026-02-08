-- Vync: videos and video_analyses for end-to-end flow
-- Run in Supabase SQL Editor or via supabase db push
-- Create Storage bucket "videos" (public) in Dashboard → Storage before uploading.

-- Videos: one row per upload; status drives UI and triggers Edge Function
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  status text not null default 'processing' check (status in ('uploading', 'processing', 'completed', 'failed')),
  created_at timestamptz not null default now()
);

-- Video analyses: one row per video when Gemini finishes. Columns: id, video_id, summary, thought_trace, chapters, key_insights.
create table if not exists public.video_analyses (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  summary text default '',
  thought_trace jsonb default '[]',
  chapters jsonb default '[]',
  key_insights jsonb default '[]',
  created_at timestamptz not null default now(),
  unique(video_id)
);

-- Realtime: frontend subscribes to this table for new/updated analyses
alter publication supabase_realtime add table public.video_analyses;

-- RLS (optional: tighten for production)
alter table public.videos enable row level security;
alter table public.video_analyses enable row level security;

create policy "Allow read on videos" on public.videos for select using (true);
create policy "Allow insert on videos" on public.videos for insert with check (true);
create policy "Allow update on videos" on public.videos for update using (true);

create policy "Allow read on video_analyses" on public.video_analyses for select using (true);
create policy "Allow insert on video_analyses" on public.video_analyses for insert with check (true);
create policy "Allow update on video_analyses" on public.video_analyses for update using (true);

comment on table public.videos is 'One row per uploaded video; status processing -> completed/failed after Gemini run';
comment on table public.video_analyses is 'Gemini analysis per video; columns: summary, thought_trace, chapters, key_insights';
