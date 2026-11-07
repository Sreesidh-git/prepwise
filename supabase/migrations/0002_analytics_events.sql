create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  anonymous_id text not null,
  path text,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now()),
  is_admin boolean not null default false,
  constraint analytics_events_event_name check (event_name in ('page_view', 'search', 'company_view', 'quiz_start', 'quiz_complete')),
  constraint analytics_events_anonymous_id_length check (length(anonymous_id) between 16 and 128),
  constraint analytics_events_path_length check (path is null or length(path) <= 500)
);

create index if not exists analytics_events_name_time_idx
  on public.analytics_events(event_name, occurred_at desc);
create index if not exists analytics_events_anonymous_idx
  on public.analytics_events(anonymous_id, occurred_at desc);

alter table public.analytics_events enable row level security;

drop policy if exists admin_read_analytics_events on public.analytics_events;
create policy admin_read_analytics_events
  on public.analytics_events for select to authenticated
  using (public.is_admin());

revoke all on public.analytics_events from anon, authenticated;
grant select on public.analytics_events to authenticated;
