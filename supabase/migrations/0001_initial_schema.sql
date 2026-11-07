create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.company_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  is_published boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint company_categories_name_not_blank check (length(btrim(name)) > 0),
  constraint company_categories_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.countries (
  id uuid primary key default gen_random_uuid(),
  legacy_code text not null unique,
  name text not null unique,
  flag text,
  currency text,
  gdp_rank integer,
  gdp text,
  top_companies jsonb not null default '[]'::jsonb,
  tech_hubs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint countries_name_not_blank check (length(btrim(name)) > 0),
  constraint countries_gdp_rank_valid check (gdp_rank is null or gdp_rank > 0)
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  legacy_id text not null unique,
  name text not null,
  short_name text not null,
  slug text not null unique,
  logo text,
  logo_color text,
  logo_background text,
  region jsonb not null default '[]'::jsonb,
  category_id uuid references public.company_categories(id) on delete set null,
  degrees jsonb not null default '[]'::jsonb,
  industry text,
  founded integer,
  headquarters text,
  ceo text,
  employees text,
  revenue text,
  website text,
  careers_url text,
  countries jsonb not null default '[]'::jsonb,
  description text,
  history text,
  milestones jsonb not null default '[]'::jsonb,
  interview_process text,
  test_pattern jsonb not null default '{}'::jsonb,
  tips jsonb not null default '[]'::jsonb,
  job_roles jsonb not null default '[]'::jsonb,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint companies_name_not_blank check (length(btrim(name)) > 0),
  constraint companies_short_name_not_blank check (length(btrim(short_name)) > 0),
  constraint companies_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint companies_founded_valid check (founded is null or founded between 1800 and 2200)
);

create table if not exists public.company_country_operations (
  company_id uuid not null references public.companies(id) on delete cascade,
  country_id uuid not null references public.countries(id) on delete cascade,
  primary key (company_id, country_id)
);

create table if not exists public.question_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  is_published boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint question_categories_name_not_blank check (length(btrim(name)) > 0)
);

create table if not exists public.interview_questions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  category_id uuid references public.question_categories(id) on delete set null,
  legacy_id integer not null,
  question_text text not null,
  options jsonb not null,
  correct_answer integer not null,
  explanation text,
  difficulty text not null default 'Intermediate',
  level text not null default 'Intermediate',
  target_roles jsonb not null default '[]'::jsonb,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (company_id, legacy_id),
  constraint interview_questions_text_not_blank check (length(btrim(question_text)) > 0),
  constraint interview_questions_options_array check (jsonb_typeof(options) = 'array'),
  constraint interview_questions_answer_nonnegative check (correct_answer >= 0),
  constraint interview_questions_difficulty check (difficulty in ('Beginner', 'Intermediate', 'Advanced', 'Legend')),
  constraint interview_questions_level check (level in ('Beginner', 'Intermediate', 'Advanced', 'Legend'))
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  category_id uuid references public.question_categories(id) on delete set null,
  level text,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint quizzes_name_not_blank check (length(btrim(name)) > 0),
  constraint quizzes_level check (level is null or level in ('Beginner', 'Intermediate', 'Advanced', 'Legend'))
);

create table if not exists public.quiz_questions (
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_id uuid not null references public.interview_questions(id) on delete cascade,
  position integer not null,
  primary key (quiz_id, question_id),
  unique (quiz_id, position),
  constraint quiz_questions_position_nonnegative check (position >= 0)
);

create table if not exists public.hiring_news (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  company_id uuid references public.companies(id) on delete set null,
  company_name text not null,
  logo text,
  badge text,
  is_internship boolean not null default false,
  title text not null,
  summary text not null,
  category text not null,
  stipend text,
  duration text,
  eligible_batches jsonb not null default '[]'::jsonb,
  cutoff text,
  apply_url text,
  practice_url text,
  source_url text,
  published_at timestamptz,
  expires_at timestamptz,
  is_published boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint hiring_news_title_not_blank check (length(btrim(title)) > 0),
  constraint hiring_news_summary_not_blank check (length(btrim(summary)) > 0)
);

create table if not exists public.website_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin',
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint admin_profiles_role check (role in ('owner', 'admin')),
  constraint admin_profiles_display_name_length check (display_name is null or length(display_name) <= 120)
);

create table if not exists public.visitor_sessions (
  id uuid primary key default gen_random_uuid(),
  anonymous_id text not null,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  landing_path text,
  exit_path text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  device_category text,
  country_code text,
  page_count integer not null default 0,
  is_admin boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  constraint visitor_sessions_anonymous_id_length check (length(anonymous_id) between 16 and 128),
  constraint visitor_sessions_page_count_nonnegative check (page_count >= 0),
  constraint visitor_sessions_device_category check (device_category is null or device_category in ('mobile', 'tablet', 'desktop', 'unknown'))
);

create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.visitor_sessions(id) on delete set null,
  anonymous_id text not null,
  path text not null,
  referrer text,
  title text,
  occurred_at timestamptz not null default timezone('utc', now()),
  device_category text,
  country_code text,
  is_admin boolean not null default false,
  constraint page_views_anonymous_id_length check (length(anonymous_id) between 16 and 128),
  constraint page_views_path_not_blank check (length(btrim(path)) > 0)
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.quizzes(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  anonymous_id text not null,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  question_count integer not null default 0,
  answered_count integer not null default 0,
  score integer,
  category text,
  level text,
  is_abandoned boolean not null default false,
  constraint quiz_attempts_anonymous_id_length check (length(anonymous_id) between 16 and 128),
  constraint quiz_attempts_counts_nonnegative check (question_count >= 0 and answered_count >= 0),
  constraint quiz_attempts_score_valid check (score is null or (score >= 0 and score <= question_count))
);

create table if not exists public.search_queries (
  id uuid primary key default gen_random_uuid(),
  anonymous_id text not null,
  query text not null,
  result_count integer,
  occurred_at timestamptz not null default timezone('utc', now()),
  is_admin boolean not null default false,
  constraint search_queries_anonymous_id_length check (length(anonymous_id) between 16 and 128),
  constraint search_queries_query_length check (length(btrim(query)) between 1 and 200),
  constraint search_queries_result_count_nonnegative check (result_count is null or result_count >= 0)
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  anonymous_id text,
  page_path text,
  company_id uuid references public.companies(id) on delete set null,
  question_id uuid references public.interview_questions(id) on delete set null,
  kind text not null default 'general',
  message text not null,
  status text not null default 'open',
  resolution_note text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint feedback_kind check (kind in ('general', 'incorrect_content', 'broken_link', 'accessibility')),
  constraint feedback_status check (status in ('open', 'in_review', 'resolved', 'dismissed')),
  constraint feedback_message_length check (length(btrim(message)) between 1 and 5000)
);

create table if not exists public.admin_activity_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint admin_activity_logs_action_not_blank check (length(btrim(action)) > 0)
);

create index if not exists companies_category_id_idx on public.companies(category_id);
create index if not exists companies_published_idx on public.companies(is_published, updated_at desc);
create index if not exists company_country_operations_country_idx on public.company_country_operations(country_id);
create index if not exists interview_questions_company_category_idx on public.interview_questions(company_id, category_id);
create index if not exists interview_questions_published_idx on public.interview_questions(is_published, updated_at desc);
create index if not exists quizzes_company_published_idx on public.quizzes(company_id, is_published);
create index if not exists hiring_news_published_idx on public.hiring_news(is_published, published_at desc);
create index if not exists page_views_occurred_at_idx on public.page_views(occurred_at desc);
create index if not exists page_views_path_idx on public.page_views(path);
create index if not exists visitor_sessions_last_seen_idx on public.visitor_sessions(last_seen_at desc);
create index if not exists quiz_attempts_started_at_idx on public.quiz_attempts(started_at desc);
create index if not exists search_queries_occurred_at_idx on public.search_queries(occurred_at desc);
create index if not exists feedback_status_idx on public.feedback(status, created_at desc);
create index if not exists admin_activity_logs_created_at_idx on public.admin_activity_logs(created_at desc);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles
    where user_id = auth.uid()
      and is_active = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

drop trigger if exists company_categories_set_updated_at on public.company_categories;
create trigger company_categories_set_updated_at before update on public.company_categories for each row execute function public.set_updated_at();
drop trigger if exists countries_set_updated_at on public.countries;
create trigger countries_set_updated_at before update on public.countries for each row execute function public.set_updated_at();
drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at before update on public.companies for each row execute function public.set_updated_at();
drop trigger if exists question_categories_set_updated_at on public.question_categories;
create trigger question_categories_set_updated_at before update on public.question_categories for each row execute function public.set_updated_at();
drop trigger if exists interview_questions_set_updated_at on public.interview_questions;
create trigger interview_questions_set_updated_at before update on public.interview_questions for each row execute function public.set_updated_at();
drop trigger if exists quizzes_set_updated_at on public.quizzes;
create trigger quizzes_set_updated_at before update on public.quizzes for each row execute function public.set_updated_at();
drop trigger if exists hiring_news_set_updated_at on public.hiring_news;
create trigger hiring_news_set_updated_at before update on public.hiring_news for each row execute function public.set_updated_at();
drop trigger if exists website_settings_set_updated_at on public.website_settings;
create trigger website_settings_set_updated_at before update on public.website_settings for each row execute function public.set_updated_at();
drop trigger if exists admin_profiles_set_updated_at on public.admin_profiles;
create trigger admin_profiles_set_updated_at before update on public.admin_profiles for each row execute function public.set_updated_at();
drop trigger if exists feedback_set_updated_at on public.feedback;
create trigger feedback_set_updated_at before update on public.feedback for each row execute function public.set_updated_at();

alter table public.company_categories enable row level security;
alter table public.countries enable row level security;
alter table public.companies enable row level security;
alter table public.company_country_operations enable row level security;
alter table public.question_categories enable row level security;
alter table public.interview_questions enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.hiring_news enable row level security;
alter table public.website_settings enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.visitor_sessions enable row level security;
alter table public.page_views enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.search_queries enable row level security;
alter table public.feedback enable row level security;
alter table public.admin_activity_logs enable row level security;

drop policy if exists public_read_published_company_categories on public.company_categories;
create policy public_read_published_company_categories on public.company_categories for select to anon, authenticated using (is_published = true or public.is_admin());
drop policy if exists public_read_countries on public.countries;
create policy public_read_countries on public.countries for select to anon, authenticated using (true);
drop policy if exists public_read_published_companies on public.companies;
create policy public_read_published_companies on public.companies for select to anon, authenticated using (is_published = true or public.is_admin());
drop policy if exists public_read_company_country_operations on public.company_country_operations;
create policy public_read_company_country_operations on public.company_country_operations for select to anon, authenticated using (
  public.is_admin()
  or exists (select 1 from public.companies c where c.id = company_id and c.is_published = true)
);
drop policy if exists public_read_published_question_categories on public.question_categories;
create policy public_read_published_question_categories on public.question_categories for select to anon, authenticated using (is_published = true or public.is_admin());
drop policy if exists public_read_published_questions on public.interview_questions;
create policy public_read_published_questions on public.interview_questions for select to anon, authenticated using (is_published = true or public.is_admin());
drop policy if exists public_read_published_quizzes on public.quizzes;
create policy public_read_published_quizzes on public.quizzes for select to anon, authenticated using (is_published = true or public.is_admin());
drop policy if exists public_read_quiz_questions on public.quiz_questions;
create policy public_read_quiz_questions on public.quiz_questions for select to anon, authenticated using (
  public.is_admin()
  or exists (select 1 from public.quizzes q where q.id = quiz_id and q.is_published = true)
);
drop policy if exists public_read_published_news on public.hiring_news;
create policy public_read_published_news on public.hiring_news for select to anon, authenticated using (is_published = true or public.is_admin());
drop policy if exists public_read_public_settings on public.website_settings;
create policy public_read_public_settings on public.website_settings for select to anon, authenticated using (is_public = true or public.is_admin());

drop policy if exists admin_manage_company_categories on public.company_categories;
create policy admin_manage_company_categories on public.company_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_manage_countries on public.countries;
create policy admin_manage_countries on public.countries for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_manage_companies on public.companies;
create policy admin_manage_companies on public.companies for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_manage_company_country_operations on public.company_country_operations;
create policy admin_manage_company_country_operations on public.company_country_operations for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_manage_question_categories on public.question_categories;
create policy admin_manage_question_categories on public.question_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_manage_questions on public.interview_questions;
create policy admin_manage_questions on public.interview_questions for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_manage_quizzes on public.quizzes;
create policy admin_manage_quizzes on public.quizzes for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_manage_quiz_questions on public.quiz_questions;
create policy admin_manage_quiz_questions on public.quiz_questions for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_manage_news on public.hiring_news;
create policy admin_manage_news on public.hiring_news for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_manage_settings on public.website_settings;
create policy admin_manage_settings on public.website_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists owner_manage_admin_profiles on public.admin_profiles;
create policy owner_manage_admin_profiles on public.admin_profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_read_sessions on public.visitor_sessions;
create policy admin_read_sessions on public.visitor_sessions for select to authenticated using (public.is_admin());
drop policy if exists admin_read_page_views on public.page_views;
create policy admin_read_page_views on public.page_views for select to authenticated using (public.is_admin());
drop policy if exists admin_read_quiz_attempts on public.quiz_attempts;
create policy admin_read_quiz_attempts on public.quiz_attempts for select to authenticated using (public.is_admin());
drop policy if exists admin_read_search_queries on public.search_queries;
create policy admin_read_search_queries on public.search_queries for select to authenticated using (public.is_admin());
drop policy if exists public_submit_feedback on public.feedback;
create policy public_submit_feedback on public.feedback for insert to anon, authenticated with check (true);
drop policy if exists admin_manage_feedback on public.feedback;
create policy admin_manage_feedback on public.feedback for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_read_activity_logs on public.admin_activity_logs;
create policy admin_read_activity_logs on public.admin_activity_logs for select to authenticated using (public.is_admin());
drop policy if exists admin_insert_activity_logs on public.admin_activity_logs;
create policy admin_insert_activity_logs on public.admin_activity_logs for insert to authenticated with check (public.is_admin() and admin_user_id = auth.uid());

revoke all on all tables in schema public from anon, authenticated;
grant select on public.company_categories, public.countries, public.companies, public.company_country_operations, public.question_categories, public.interview_questions, public.quizzes, public.quiz_questions, public.hiring_news, public.website_settings to anon, authenticated;
grant insert on public.feedback to anon, authenticated;
grant select, insert, update on public.page_views, public.visitor_sessions, public.quiz_attempts, public.search_queries to authenticated;
grant select on public.admin_profiles, public.admin_activity_logs to authenticated;
grant all on public.company_categories, public.countries, public.companies, public.company_country_operations, public.question_categories, public.interview_questions, public.quizzes, public.quiz_questions, public.hiring_news, public.website_settings, public.feedback, public.admin_profiles, public.admin_activity_logs to authenticated;
