-- QA submissions from the public /qa checklist. No RLS policies at all
-- is deliberate here, same pattern as `grades`: this table is only ever
-- written by /api/qa-submit and only ever read by the admin page, both
-- via the service-role client, which bypasses RLS entirely. Public
-- testers filling out /qa never get direct database access.

create table if not exists qa_submissions (
  id uuid primary key default gen_random_uuid(),
  tester_name text,
  device text,
  test_date date,
  results jsonb not null,   -- { [testId]: { result: 'pass'|'fail'|'na', notes: string } }
  submitted_at timestamptz not null default now()
);

alter table qa_submissions enable row level security;