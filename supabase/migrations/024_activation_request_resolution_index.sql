create index if not exists activation_requests_resolved_by_idx
on public.activation_requests(resolved_by)
where resolved_by is not null;
