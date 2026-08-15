create index if not exists partners_archived_by_idx
on public.partners(archived_by)
where archived_by is not null;
