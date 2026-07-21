/**
 * Computes per-module pipeline state: 'locked' | 'active' | 'past'.
 *
 * Runs 4 queries total, regardless of module count — modules, then all
 * quizzes/questions/submissions in one shot each, joined in memory.
 * The previous version queried quizzes and submissions separately for
 * EVERY module (1 + 2N round trips), which is what was actually making
 * the dashboard slow — not dev-mode overhead.
 *
 * - locked: the teaching session hasn't happened yet. Not accessible.
 * - active: taught, but the quiz isn't cleanly finished (unanswered
 *   questions, or something awaiting manual review).
 * - past: taught, fully answered, nothing pending manual review.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 */
export async function getModulesWithStatus(supabase, userId) {
  const { data: modules } = await supabase
    .from("modules")
    .select("id, slug, title, order_index, sessions(status, scheduled_date)")
    .order("order_index");

  if (!modules || modules.length === 0) return [];

  const moduleIds = modules.map((m) => m.id);

  const { data: quizzes } = await supabase
    .from("quizzes")
    .select("id, module_id, questions(id, max_score)")
    .in("module_id", moduleIds);

  const quizByModuleId = new Map((quizzes ?? []).map((q) => [q.module_id, q]));

  const allQuestionIds = (quizzes ?? []).flatMap((q) => (q.questions ?? []).map((question) => question.id));

  const { data: submissions } =
    allQuestionIds.length > 0
      ? await supabase
          .from("submissions")
          .select("question_id, grades(score, max_score, graded_by)")
          .eq("user_id", userId)
          .in("question_id", allQuestionIds)
          .order("submitted_at", { ascending: true })
      : { data: [] };

  // Retries create additional rows rather than overwriting — ordering
  // ascending + unconditional overwrite below means each question ends
  // up mapped to its most recent attempt, which is what "is this module
  // done" should be judged against, not an earlier wrong attempt.
  const submissionsByQuestionId = new Map();
  for (const submission of submissions ?? []) {
    submissionsByQuestionId.set(submission.question_id, submission);
  }

  return modules.map((module) => {
    const session = module.sessions?.[0];
    const scheduledDate = session?.scheduled_date ?? null;
    const base = {
      id: module.id,
      slug: module.slug,
      title: module.title,
      orderIndex: module.order_index,
      scheduledDate,
    };

    if (!session || session.status === "not_started") {
      return { ...base, lockState: "locked", needsReview: false, avgScorePct: null };
    }

    const quiz = quizByModuleId.get(module.id);
    const questions = quiz?.questions ?? [];

    if (questions.length === 0) {
      return {
        ...base,
        lockState: session.status === "completed" ? "past" : "active",
        needsReview: false,
        avgScorePct: null,
      };
    }

    let answeredCount = 0;
    let needsReview = false;
    let totalScore = 0;
    let totalMax = 0;

    for (const question of questions) {
      const submission = submissionsByQuestionId.get(question.id);
      if (!submission) continue;
      answeredCount += 1;

      const grade = submission.grades?.[0];
      if (!grade) continue;
      if (grade.graded_by === "manual") needsReview = true;
      totalScore += grade.score;
      totalMax += grade.max_score;
    }

    const quizComplete = answeredCount === questions.length;
    const avgScorePct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null;
    const lockState =
      session.status === "completed" && quizComplete && !needsReview ? "past" : "active";

    return { ...base, lockState, needsReview, avgScorePct };
  });
}