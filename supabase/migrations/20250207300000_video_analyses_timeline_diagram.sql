-- Add timeline_data and diagram_data for Intelligence Timeline and Temporal Flow Diagram
alter table public.video_analyses add column if not exists timeline_data jsonb default '[]';
alter table public.video_analyses add column if not exists diagram_data jsonb default '[]';
comment on column public.video_analyses.timeline_data is 'Timeline markers for Intelligence Timeline: [{ position, label, type }]';
comment on column public.video_analyses.diagram_data is 'Temporal flow for diagram: [{ time_seconds, label, description }]';
