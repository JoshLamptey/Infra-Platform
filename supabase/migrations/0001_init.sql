-- Infra Learning Console — initial schema
-- Auth is Supabase's built-in `auth.users`. Every user-owned table carries
-- a `user_id` and an RLS policy scoping it to `auth.uid()`, so this works
-- unchanged whether there's one user or many.

create table if not exists modules (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  order_index int not null,
  description text
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references modules(id) on delete cascade,
  scheduled_date date not null,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'completed'))
);

create table if not exists quizzes (
  id uuid primary key default gen_random_uuid(),
  module_id uuid unique references modules(id) on delete cascade,
  title text not null,
  deadline timestamptz,
  is_open boolean not null default true
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references quizzes(id) on delete cascade,
  external_id text unique,     -- stable id from content JSON (e.g. "m1q1"), used by the seed script for idempotent upserts
  type text not null check (type in ('mcq', 'open')),
  prompt text not null,
  options jsonb,               -- for mcq: [{ "id": "a", "label": "..." }, ...]
  correct_answer text,         -- for mcq: matches an option id
  rubric text,                 -- for open: grading guidance passed to the grader
  max_score int not null default 10,
  order_index int not null default 0
);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid references questions(id) on delete cascade,
  answer_text text not null,
  submitted_at timestamptz not null default now()
);

create table if not exists grades (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references submissions(id) on delete cascade,
  score int not null,
  max_score int not null,
  feedback text,
  graded_by text not null check (graded_by in ('auto', 'manual')),
  graded_at timestamptz not null default now()
);

-- Reference/content tables: readable by any signed-in user, not writable
-- from the client (content changes ship via migrations/CI, not the app).
alter table modules enable row level security;
alter table sessions enable row level security;
alter table quizzes enable row level security;
alter table questions enable row level security;

create policy "modules readable by signed-in users"
  on modules for select using (auth.role() = 'authenticated');
create policy "sessions readable by signed-in users"
  on sessions for select using (auth.role() = 'authenticated');
create policy "quizzes readable by signed-in users"
  on quizzes for select using (auth.role() = 'authenticated');
create policy "questions readable by signed-in users"
  on questions for select using (auth.role() = 'authenticated');

-- User-owned tables: each learner only ever sees their own submissions
-- and grades. This is the policy that makes "share with friends" safe
-- later without changing a single line of app code.
alter table submissions enable row level security;
alter table grades enable row level security;

create policy "users manage their own submissions"
  on submissions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users read grades on their own submissions"
  on grades for select
  using (
    exists (
      select 1 from submissions
      where submissions.id = grades.submission_id
        and submissions.user_id = auth.uid()
    )
  );

-- Grades are written by the server-side grading route using the Supabase
-- service role key, which bypasses RLS — no client-side insert policy
-- needed or wanted here.
