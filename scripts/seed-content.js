// Syncs content/curriculum.json (the full roadmap) plus content/modules
// and content/quizzes (actual authored content, where it exists) into
// Supabase. Idempotent — safe to run every time content changes.
//
// Every week listed in curriculum.json gets a `modules` + `sessions` row
// regardless of whether its content has been written yet — that's what
// makes future weeks show up as locked placeholders instead of being
// invisible. Once content/modules/<slug>.md exists, its frontmatter
// (title/order) takes over as authoritative for that module.
//
// Usage: npm run seed   (reads .env.local automatically)

import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });
const CURRICULUM_PATH = path.join(process.cwd(), "content/curriculum.json");
const MODULES_DIR = path.join(process.cwd(), "content/modules");
const QUIZZES_DIR = path.join(process.cwd(), "content/quizzes");

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

  const curriculum = JSON.parse(fs.readFileSync(CURRICULUM_PATH, "utf-8"));

  for (const entry of curriculum) {
    const contentPath = path.join(MODULES_DIR, `${entry.slug}.md`);
    const hasContent = fs.existsSync(contentPath);

    let title = entry.title;
    let order = entry.order;

    if (hasContent) {
      const raw = fs.readFileSync(contentPath, "utf-8");
      const { data } = matter(raw);
      // Content frontmatter is authoritative once it exists.
      title = data.title ?? title;
      order = data.order ?? order;
    }

    console.log(`Module: ${entry.slug}${hasContent ? "" : " (placeholder, no content yet)"}`);

    const { data: moduleRow, error: moduleError } = await supabase
      .from("modules")
      .upsert({ slug: entry.slug, title, order_index: order }, { onConflict: "slug" })
      .select()
      .single();

    if (moduleError) throw moduleError;

    const { data: existingSession } = await supabase
      .from("sessions")
      .select("id")
      .eq("module_id", moduleRow.id)
      .maybeSingle();

    if (existingSession) {
      await supabase
        .from("sessions")
        .update({ scheduled_date: entry.scheduledDate, status: entry.status })
        .eq("id", existingSession.id);
    } else {
      await supabase.from("sessions").insert({
        module_id: moduleRow.id,
        scheduled_date: entry.scheduledDate,
        status: entry.status,
      });
    }

    if (!hasContent) continue; // nothing further to seed for an unwritten week

    const quizFile = fs
      .readdirSync(QUIZZES_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(fs.readFileSync(path.join(QUIZZES_DIR, f), "utf-8")))
      .find((q) => q.moduleSlug === entry.slug);

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