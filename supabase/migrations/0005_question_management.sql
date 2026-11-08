-- Migration 0005: Enhanced Question Management and Editorial Review
-- Local proposal: Do NOT execute on production without owner approval.

-- 1. Add editorial review tracking columns to public.interview_questions
alter table public.interview_questions
  add column if not exists review_status text not null default 'approved'
  check (review_status in ('approved', 'needs_review', 'under_review', 'draft', 'archived'));

alter table public.interview_questions
  add column if not exists review_notes text;

-- 2. Index review status for quick filtering of flagged questions
create index if not exists interview_questions_review_status_idx
  on public.interview_questions(review_status);

-- 3. Administrative view for unified question searching, joining company and category metadata
-- Hardened with security_invoker = true and WHERE public.is_admin() to prevent unauthorized reads of draft questions or review notes
create or replace view public.admin_questions_view
with (security_invoker = true) as
select
  q.id,
  q.company_id,
  c.name as company_name,
  c.slug as company_slug,
  q.category_id,
  cat.name as category_name,
  cat.slug as category_slug,
  q.legacy_id,
  q.question_text,
  q.options,
  q.correct_answer,
  q.explanation,
  q.difficulty,
  q.level,
  q.target_roles,
  q.review_status,
  q.review_notes,
  q.is_published,
  q.published_at,
  q.created_at,
  q.updated_at
from public.interview_questions q
left join public.companies c on q.company_id = c.id
left join public.question_categories cat on q.category_id = cat.id
where public.is_admin();

-- 4. Permissions: View access restricted to authenticated administrators
revoke all on public.admin_questions_view from public;
grant select on public.admin_questions_view to authenticated;
