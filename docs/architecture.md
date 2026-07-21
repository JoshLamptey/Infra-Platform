# Infra Learning Console — Architecture (v2, as-built)

Supersedes the original architecture plan. Reflects what's actually in the
delivered codebase, not just what was proposed.

## Open decision (unresolved as of this doc)

**Next.js vs. plain React + Supabase Edge Functions.** Current build uses
Next.js App Router for its built-in Route Handlers and middleware, which
give a place to hold secrets (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`)
without a separate backend service. The alternative — a static Vite+React
SPA with grading logic moved into Supabase Edge Functions — removes
Next.js's framework surface (and its CVE history) entirely and is a
legitimate simpler option for what this app actually does. Not yet
decided; everything below documents the current (Next.js) build.

## Stack (as-built)

| Layer | Choice | Notes |
| --- | --- | --- |
| Frontend | Next.js 14 (App Router), **plain JavaScript/JSX** — no TypeScript | Pinned to `^14.2.35` — earlier 14.x versions carry active CVEs, including a middleware auth-bypass (CVE-2025-29927) directly relevant since this app uses `middleware.js` |
| Styling | Tailwind CSS, custom token palette (not a UI kit) | Pipeline/status-node visual motif mirrors the learning content own CI gate pattern |
| Hosting | Vercel (free tier) | Deploys automatically on push via git integration — no custom deploy step in CI |
| Backend/DB | Supabase (Postgres + Auth), free tier | RLS enabled on all user-owned tables from day one |
| Auth | Supabase magic-link (email OTP), no passwords | Multi-user-ready: every policy keys off `auth.uid()` |
| Auto-marking (objective) | Plain equality check, no API call | `lib/grading.js` → `gradeObjective()` |
| Auto-marking (open-ended) | **Gemini API free tier** (`gemini-3.1-flash-lite`), not Anthropic | Switched from the original plan (Claude) specifically to avoid a paid service. ~1,500 req/day, 1M TPM free, no card required. Caveat: free-tier prompts/responses may be used by Google to improve their models — acceptable for infra-quiz content, worth knowing if grading anything sensitive later |
| CI | GitHub Actions | Lint → build → (on push to `main` only) seed content into Supabase. Does **not** handle the frontend deploy — Vercel's git integration already does that |

## Database schema (as-built, differs from v1 plan)

```js
modules(id, slug, title, order_index, description)
sessions(id, module_id, scheduled_date, status)
quizzes(id, module_id UNIQUE, title, deadline, is_open)
questions(id, quiz_id, external_id UNIQUE, type, prompt, options, correct_answer, rubric, max_score, order_index)
submissions(id, user_id → auth.users, question_id, answer_text, submitted_at)
grades(id, submission_id, score, max_score, feedback, graded_by ['auto'|'manual'], graded_at)
```

Changes from the original plan:

- `quizzes.module_id` is **UNIQUE** — enforces one quiz per module, and gives the seed script a real upsert target (`onConflict: "module_id"`).
- `questions.external_id` **added** — a stable ID from the content JSON (e.g. `"m1q1"`). This is what makes the seed script idempotent: re-running it after editing a question updates the existing row instead of creating a duplicate.

### RLS policy summary

| Table | Read | Write |
| --- | --- | --- |
| `modules`, `sessions`, `quizzes`, `questions` | Any signed-in user | Not writable from the client at all — content changes ship via `npm run seed`, using the service-role key |
| `submissions` | Owner only (`auth.uid() = user_id`) | Owner only, insert/update/delete |
| `grades` | Owner-of-parent-submission only | **No client policy at all** — only written server-side via the admin (service-role) client in `/api/submit` and `/api/grade` |

## Content → database flow

Content is authored as files in git (`content/modules/*.md`, `content/quizzes/*.json`), not directly in Supabase. `content/curriculum.json` is the master roadmap — every planned week is listed there (slug, title, order, scheduled date, status) regardless of whether its content has been written yet. This is what makes future weeks show up as locked placeholders instead of being invisible: the seed script creates a `modules`/`sessions` row for every entry in the manifest, and only layers in `quizzes`/`questions` where a matching content file actually exists. Once `content/modules/<slug>.md` exists, its frontmatter (`title`/`order`) overrides the manifest's placeholder values for that module.

`scripts/seed-content.js` runs:

- Manually: `npm run seed` (reads `.env.local`)
- Automatically: as a gated job in `.github/workflows/ci.yml`, only on push to `main`, only after lint and build both pass

This is the actual mechanism behind "push updates the week's material" — there's no custom CMS, the git repo *is* the CMS.

## API routes

| Route | Purpose | Auth model |
| --- | --- | --- |
| `POST /api/submit` | Insert a submission, grade it (objective or Gemini), insert the grade | Requires signed-in user; submission insert uses the user's own session (RLS-scoped); grade insert uses the service-role client |
| `POST /api/grade` | Re-grade an existing submission by ID (e.g. after a rubric edit, or to retry a submission left "needs manual review") | Requires signed-in user; only works on submissions RLS confirms belong to them |
| `GET /auth/callback` | Exchanges the magic-link code for a session | Public (this *is* the sign-in step) |

## What's seeded today

`content/curriculum.json` lists all 9 planned modules — all 9 now get a
`modules`/`sessions` row (and therefore a pipeline card) on every seed
run. Only `module-01-containers` has actual written content and a quiz;
weeks 2–9 render as locked placeholders using the manifest's title until
their content files are added.

## Post-launch backlog

- **Make learning content more immersive** (requested, deliberately deferred). Current module pages are plain rendered markdown. Explicitly agreed this is the first post-production push, not a pre-launch blocker — revisit once the app is live and stable.
- **Admin page** (proposed, not yet scoped). Ideas raised: receive QA checklist results as structured submissions instead of copy-pasted text, so failures can be grouped/analyzed for patterns rather than read linearly; uptime tracking; uploading/editing learning content through a UI instead of pushing to the repo (would be a genuine alternative to the git-as-CMS model described above, not a small addition — worth a real design pass before building, not a quick bolt-on).

## Resolved issues (kept here as a record, not because they're still open)

- **CI seed job failing on Node 20** (`Error: Node.js detected but native WebSocket not found`). `@supabase/supabase-js` initializes a Realtime client on construction even though this app never uses Realtime, and that client requires native `WebSocket` support, which Node only has from v22 onward. Fixed by bumping `node-version` to `"22"` in all three CI jobs and adding `"engines": { "node": ">=22" }` to `package.json` so local/CI/Vercel can't silently drift apart on this again.
- **Future weeks not appearing in the pipeline at all.** The seed script used to only create a `modules` row for slugs that already had a `content/modules/*.md` file — so unwritten weeks didn't exist in Supabase, not even as locked placeholders. Fixed by introducing `content/curriculum.json` as the master roadmap (see "Content → database flow" above); every listed week now gets seeded regardless of whether its content is written yet.

## Known residual items (not blockers, tracked here so they're not lost)

- `npm audit` still flags a handful of lower-severity advisories on the current Next.js line, all tied to features this app doesn't use (`next/image` remotePatterns, i18n middleware, WebSocket upgrades). Not force-upgraded to Next 16 since that's a breaking change that needs its own testing pass.
- `tailwind.config.js` has one cosmetic ESLint warning (anonymous default export) — harmless, not fixed yet.
