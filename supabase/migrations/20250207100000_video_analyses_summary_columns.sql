-- Legacy: add columns if table had old schema. Prefer running 20250207200000_video_analyses_exact_schema.sql for full sync.

alter table public.video_analyses add column if not exists summary text;
alter table public.video_analyses add column if not exists thought_trace jsonb default '[]';
alter table public.video_analyses add column if not exists chapters jsonb default '[]';
alter table public.video_analyses add column if not exists key_insights jsonb default '[]';

comment on column public.video_analyses.summary is 'Main summary text from Gemini';
comment on column public.video_analyses.thought_trace is 'Array of reasoning steps';
comment on column public.video_analyses.chapters is 'Array of {title, start_seconds, end_seconds?}';
comment on column public.video_analyses.key_insights is 'Array of key insight strings';
