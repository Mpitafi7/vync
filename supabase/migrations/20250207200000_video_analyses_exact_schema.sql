-- Vync: video_analyses exact schema. Run after create_videos_tables.
-- Ensures table has exactly: id, video_id, summary, thought_trace, chapters, key_insights
-- (and created_at if present). Removes analysis_data / technical_summary.

-- Add columns if missing (safe for existing tables)
alter table public.video_analyses add column if not exists summary text default '';
alter table public.video_analyses add column if not exists thought_trace jsonb default '[]';
alter table public.video_analyses add column if not exists chapters jsonb default '[]';
alter table public.video_analyses add column if not exists key_insights jsonb default '[]';

-- Drop legacy columns so select() only sees the exact schema
alter table public.video_analyses drop column if exists analysis_data;
alter table public.video_analyses drop column if exists technical_summary;

-- Comments for schema clarity
comment on column public.video_analyses.summary is 'Main summary text from Gemini';
comment on column public.video_analyses.thought_trace is 'Array of reasoning step strings';
comment on column public.video_analyses.chapters is 'Array of {title, start_seconds, end_seconds?}';
comment on column public.video_analyses.key_insights is 'Array of key insight strings';
