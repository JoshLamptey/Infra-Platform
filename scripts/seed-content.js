// Syncs content/modules and content/quizzes into Supabase. Idempotent —
// safe to run every time content changes, whether by hand or from CI.
//
// Usage: npm run seed   (reads .env.local automatically)

import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { createClient } from "@supabase/supabase-js";


dotenv.config({ path: ".env.local" });


const MODULES_DIR = path.join(process.cwd(), "content/modules");
const QUIZZES_DIR = path.join(process.cwd(), "content/quizzes");

// The full course timetable. Modules without a matching content file yet
// are skipped — add the .md file and re-run seed to activate a module.
const SCHEDULE = {
  "module-01-containers": { date: "2026-07-18", status: "completed" },
  "module-02-compose": { date: "2026-07-21", status: "not_started" },
  "module-03-process-management": { date: "2026-07-25", status: "not_started" },
  "module-04-nginx-tls": { date: "2026-07-28", status: "not_started" },
  "module-05-ci-design": { date: "2026-08-04", status: "not_started" },
  "module-06-supply-chain": { date: "2026-08-08", status: "not_started" },
  "module-07-image-lifecycle": { date: "2026-08-15", status: "not_started" },
  "module-08-deploys-rollback": { date: "2026-08-18", status: "not_started" },
  "module-09-hotfix-backups": { date: "2026-08-25", status: "not_started" },
};

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  );

  const moduleFiles = fs.readdirSync(MODULES_DIR).filter((f) => f.endsWith(".md"));

  for (const file of moduleFiles) {
    const raw = fs.readFileSync(path.join(MODULES_DIR, file), "utf-8");
    const { data } = matter(raw);

    console.log(`Module: ${data.slug}`);

    const { data: moduleRow, error: moduleError } = await supabase
      .from("modules")
      .upsert(
        { slug: data.slug, title: data.title, order_index: data.order },
        { onConflict: "slug" }
      )
      .select()
      .single();

    if (moduleError) throw moduleError;

    const schedule = SCHEDULE[data.slug];
    if (schedule) {
      const { data: existingSession } = await supabase
        .from("sessions")
        .select("id")
        .eq("module_id", moduleRow.id)
        .maybeSingle();

      if (existingSession) {
        await supabase
          .from("sessions")
          .update({ scheduled_date: schedule.date, status: schedule.status })
          .eq("id", existingSession.id);
      } else {
        await supabase.from("sessions").insert({
          module_id: moduleRow.id,
          scheduled_date: schedule.date,
          status: schedule.status,
        });
      }
    }

    const quizFile = fs
      .readdirSync(QUIZZES_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(fs.readFileSync(path.join(QUIZZES_DIR, f), "utf-8")))
      .find((q) => q.moduleSlug === data.slug);

    if (!quizFile) continue;

    console.log(`  Quiz: ${quizFile.title} (${quizFile.questions.length} questions)`);

    const { data: quizRow, error: quizError } = await supabase
      .from("quizzes")
      .upsert(
        { module_id: moduleRow.id, title: quizFile.title },
        { onConflict: "module_id" }
      )
      .select()
      .single();

    if (quizError) throw quizError;

    for (const [index, question] of quizFile.questions.entries()) {
      const { error: questionError } = await supabase.from("questions").upsert(
        {
          quiz_id: quizRow.id,
          external_id: question.id,
          type: question.type,
          prompt: question.prompt,
          options: question.options ?? null,
          correct_answer: question.correctAnswer ?? null,
          rubric: question.rubric ?? null,
          max_score: question.maxScore,
          order_index: index,
        },
        { onConflict: "external_id" }
      );

      if (questionError) throw questionError;
    }
  }

  console.log("Seed complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
