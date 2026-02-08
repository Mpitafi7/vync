-- Allow status 'uploading' (row created before storage upload finishes)
alter table public.videos drop constraint if exists videos_status_check;
alter table public.videos add constraint videos_status_check
  check (status in ('uploading', 'processing', 'completed', 'failed'));
