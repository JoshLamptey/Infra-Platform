import { redirect, notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getModule } from "@/lib/content";
import { getModulesWithStatus } from "@/lib/moduleStatus";

export default async function ModulePage({ params }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const moduleContent = getModule(params.slug);
  if (!moduleContent) notFound();

  // Enforce the lock server-side too — hiding the link on the
  // dashboard isn't access control, this is.
  const modulesWithStatus = await getModulesWithStatus(supabase, user.id);
  const status = modulesWithStatus.find((m) => m.slug === params.slug);
  if (!status || status.lockState === "locked") {
    redirect("/");
  }

  const { data: moduleRow } = await supabase
    .from("modules")
    .select("id, quizzes(id, title)")
    .eq("slug", params.slug)
    .maybeSingle();

  // `quizzes.module_id` is UNIQUE, so Supabase treats modules -> quizzes
  // as one-to-one and returns a single object here, not an array. This
  // used to be `moduleRow?.quizzes?.[0]`, which silently evaluated to
  // undefined and made the quiz card disappear entirely.
  const quiz = moduleRow?.quizzes;

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/" className="text-xs font-mono text-textMuted hover:text-accent">
        ← pipeline
      </Link>

      <h1 className="text-2xl font-semibold mt-4 mb-6">{moduleContent.title}</h1>

      <article className="prose-invert max-w-none space-y-4 text-[15px] leading-relaxed [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-2 [&_table]:w-full [&_table]:text-sm [&_th]:text-left [&_th]:border-b [&_th]:border-border [&_th]:py-1.5 [&_td]:border-b [&_td]:border-border [&_td]:py-1.5 [&_code]:font-mono [&_code]:text-accent">
        <ReactMarkdown>{moduleContent.body}</ReactMarkdown>
      </article>

      {quiz && (
        <div className="mt-10 rounded-md border border-border bg-surface p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{quiz.title}</p>
            <p className="text-xs text-textMuted">
              {status.lockState === "past" ? "Already taken — review below." : "Ready when you are."}
            </p>
          </div>
          <Link
            href={`/quiz/${quiz.id}`}
            className="rounded-md bg-accent text-bg text-sm font-medium px-4 py-2"
          >
            {status.lockState === "past" ? "Review quiz" : "Take quiz"}
          </Link>
        </div>
      )}
    </main>
  );
}