import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import QuizRunner from "@/components/QuizRunner";

export default async function QuizPage({ params }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, title, deadline, module_id, questions(*), modules(slug, title)")
    .eq("id", params.quizId)
    .maybeSingle();

  if (!quiz) notFound();

  const parentModule = quiz.modules;

  const questionIds = quiz.questions.map((q) => q.id);
  const { data: submissions } = await supabase
    .from("submissions")
    .select("*, grades(*)")
    .eq("user_id", user.id)
    .in("question_id", questionIds)
    .order("submitted_at", { ascending: true });

  // Multiple attempts can exist per question (retakes/corrections) —
  // keep every row for history, but the map used to render the quiz
  // should only ever reflect the MOST RECENT attempt per question.
  // Ordering ascending + unconditional overwrite in this loop means
  // the last write for a given question is always its latest attempt.
  const existingSubmissionsByQuestion = {};
  const attemptCountByQuestion = {};
  for (const submission of submissions ?? []) {
    existingSubmissionsByQuestion[submission.question_id] = submission;
    attemptCountByQuestion[submission.question_id] =
      (attemptCountByQuestion[submission.question_id] ?? 0) + 1;
  }

  const questions = quiz.questions
    .slice()
    .sort((a, b) => a.order_index - b.order_index)
    .map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      maxScore: q.max_score,
    }));

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <Link
        href={parentModule ? `/modules/${parentModule.slug}` : "/"}
        className="text-xs font-mono text-textMuted hover:text-accent"
      >
        ← {parentModule ? parentModule.title : "pipeline"}
      </Link>

      <h1 className="text-2xl font-semibold mt-4 mb-1">{quiz.title}</h1>
      {quiz.deadline && (
        <p className="text-sm text-textMuted mb-6">
          Due {new Date(quiz.deadline).toLocaleDateString()}
        </p>
      )}

      <QuizRunner
        quiz={{ ...quiz, questions }}
        existingSubmissionsByQuestion={existingSubmissionsByQuestion}
        attemptCountByQuestion={attemptCountByQuestion}
      />
    </main>
  );
}