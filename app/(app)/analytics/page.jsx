import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AnalyticsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Small dataset at personal-project scale — aggregating in JS here is
  // fine. Worth moving to a SQL view if this ever needs to scale past a
  // handful of learners.
  const { data: submissions } = await supabase
    .from("submissions")
    .select(
      "id, submitted_at, grades(score, max_score, graded_by), questions(quiz_id, quizzes(module_id, modules(title, order_index)))"
    )
    .eq("user_id", user.id);

  const byModule = {};
  for (const submission of submissions ?? []) {
    const moduleInfo = submission.questions?.quizzes?.modules;
    const grade = submission.grades?.[0];
    if (!moduleInfo || !grade) continue;

    const key = moduleInfo.title;
    byModule[key] ??= { title: moduleInfo.title, order: moduleInfo.order_index, totalScore: 0, totalMax: 0, count: 0, needsReview: 0 };
    byModule[key].totalScore += grade.score;
    byModule[key].totalMax += grade.max_score;
    byModule[key].count += 1;
    if (grade.graded_by === "manual") byModule[key].needsReview += 1;
  }

  const rows = Object.values(byModule).sort((a, b) => a.order - b.order);

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-6">Analytics</h1>

      {rows.length === 0 ? (
        <p className="text-sm text-textMuted">No graded submissions yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-textMuted font-mono text-xs border-b border-border">
              <th className="py-2">Module</th>
              <th className="py-2">Questions answered</th>
              <th className="py-2">Average score</th>
              <th className="py-2">Needs review</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.title} className="border-b border-border">
                <td className="py-2">{row.title}</td>
                <td className="py-2">{row.count}</td>
                <td className="py-2">
                  {row.totalMax > 0
                    ? `${Math.round((row.totalScore / row.totalMax) * 100)}%`
                    : "—"}
                </td>
                <td className="py-2">
                  {row.needsReview > 0 ? (
                    <span className="text-pending">{row.needsReview}</span>
                  ) : (
                    "0"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}