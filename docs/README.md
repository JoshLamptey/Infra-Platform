# Infra Learning Console

A personal DevOps learning tracker: module content, auto-graded quizzes
(objective + open-ended via a free LLM API), deadlines, and score
analytics — built alongside the ERP infra/DevOps curriculum itself.

## Stack

- **Frontend:** Next.js 14 (App Router), plain JavaScript/JSX, Tailwind CSS
- **Hosting:** Vercel (free tier, deploys on push via git integration)
- **Backend:** Supabase (Postgres + Auth, free tier)
- **Auto-marking:** exact-match for objective questions; [Gemini API](https://aistudio.google.com/apikey) free tier for open-ended reasoning answers
- **CI:** GitHub Actions — lints, builds, and (on push to `main`) syncs `/content` into Supabase

## First-time setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. In the SQL Editor, run `supabase/migrations/0001_init.sql`.
3. In **Project Settings → API**, copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep this one secret — never commit it, never prefix it `NEXT_PUBLIC_`)
4. In **Authentication → URL Configuration**, add your local (`http://localhost:3000`) and deployed URLs as redirect URLs — needed for the magic-link sign-in to work.

### 2. Gemini API key (free, no credit card)

Get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → `GEMINI_API_KEY`.

Note: on the free tier, Google may use your prompts/responses to improve their models. Fine for infra-quiz answers; worth knowing.

### 3. Local environment

```bash
cp .env.example .env.local
# fill in the four values above
npm install
npm run seed    # syncs content/modules + content/quizzes into Supabase
npm run dev
```

### 4. Deploy

1. Push this repo to GitHub.
2. Import it into [Vercel](https://vercel.com) — its git integration deploys automatically on every push to `main`, no extra config needed.
3. Add the same four env vars in Vercel's project settings.
4. In your GitHub repo settings, add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` as **Actions secrets** — this is what lets `.github/workflows/ci.yml` lint/build every PR and sync content on every push to `main`.

## How "push updates the week's material" actually works

1. Edit or add a file in `content/modules/` (module prose) and/or `content/quizzes/` (questions + rubrics).
2. Push to `main`.
3. GitHub Actions lints + builds (gate), then runs `npm run seed`, which upserts your content into Supabase.
4. Vercel's own git integration deploys the new frontend in parallel.

No custom deploy pipeline needed for the frontend itself — Vercel already does that on push. The Actions workflow's job is the gate (lint/build must pass) and the content sync, not re-implementing what Vercel gives you for free.

## Adding a new module

1. Add `content/modules/module-0N-slug.md` with frontmatter (`slug`, `title`, `order`).
2. Add `content/quizzes/module-0N-quiz.json` with `moduleSlug` matching the module's slug.
3. Add an entry to the `SCHEDULE` map in `scripts/seed-content.js` with the session date.
4. Push. CI seeds it automatically.

## Auth

Email magic-link via Supabase Auth — no passwords. Every user-owned table
(`submissions`, `grades`) is scoped by Row Level Security to `auth.uid()`,
so this already works correctly for multiple learners even though it's
single-user today. Nothing to change later to "share with friends" beyond
inviting them to sign in.

## Project structure

```js
/app                    Next.js pages + API routes
/components              Shared React components
/content/modules         Module prose (markdown + frontmatter)
/content/quizzes         Quiz questions + rubrics (JSON)
/lib                      Supabase clients, content loader, grading logic
/scripts/seed-content.js  Syncs /content into Supabase (idempotent)
/supabase/migrations      SQL schema
```
