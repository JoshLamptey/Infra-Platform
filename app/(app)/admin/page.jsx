import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/isAdmin";
import { findTest } from "@/lib/qaTests";
import AdminModuleStatusEditor from "@/components/AdminModuleStatusEditor";

export default async function AdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/");

  const admin = createAdminClient();

  const { data: submissions } = await admin
    .from("qa_submissions")
    .select("*")
    .order("submitted_at", { ascending: false });

  const { data: modules } = await supabase
    .from("modules")
    .select("id, title, order_index, sessions(status)")
    .order("order_index");

  const modulesForEditor = (modules ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    order_index: m.order_index,
    status: m.sessions?.[0]?.status ?? "not_started",
  }));

  // Group every test's results across ALL submissions, so a failure
  // pattern on one specific test is visible at a glance rather than
  // buried inside individual submission records.
  const byTest = {};
  for (const submission of submissions ?? []) {
    for (const [testId, entry] of Object.entries(submission.results ?? {})) {
      byTest[testId] ??= { pass: 0, fail: 0, na: 0, failNotes: [] };
      if (entry.result === "pass") byTest[testId].pass += 1;
      else if (entry.result === "fail") {
        byTest[testId].fail += 1;
        if (entry.notes) {
          byTest[testId].failNotes.push({
            notes: entry.notes,
            tester: submission.tester_name || "anonymous",
          });
        }
      } else if (entry.result === "na") byTest[testId].na += 1;
    }
  }

  const testRows = Object.entries(byTest)
    .map(([testId, counts]) => ({ testId, test: findTest(testId), ...counts }))
    .filter((row) => row.test)
    .sort((a, b) => b.fail - a.fail); // worst offenders first

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-12">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Admin</h1>
        <p className="text-sm text-textMuted">Signed in as {user.email}</p>
      </div>

      <section>
        <h2 className="text-sm font-mono text-accent mb-3">Module status</h2>
        <AdminModuleStatusEditor modules={modulesForEditor} />
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-mono text-accent">QA results by test</h2>
          <span className="text-xs text-textMuted">
            {(submissions ?? []).length} submission{(submissions ?? []).length === 1 ? "" : "s"}
          </span>
        </div>

        {testRows.length === 0 ? (
          <p className="text-sm text-textMuted">No QA submissions yet. Share the /qa link to collect some.</p>
        ) : (
          <div className="space-y-2">
            {testRows.map((row) => (
              <details
                key={row.testId}
                className="rounded-md border border-border bg-surface px-4 py-3 group"
              >
                <summary className="cursor-pointer flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{row.test.action}</span>
                  <span className="shrink-0 flex items-center gap-2 text-xs font-mono">
                    {row.fail > 0 && <span className="text-danger">{row.fail} fail</span>}
                    <span className="text-success">{row.pass} pass</span>
                    {row.na > 0 && <span className="text-textMuted">{row.na} n/a</span>}
                  </span>
                </summary>
                <div className="mt-3 pt-3 border-t border-border text-xs text-textMuted space-y-2">
                  <p><b>Should happen:</b> {row.test.expected}</p>
                  {row.failNotes.length > 0 && (
                    <div>
                      <p className="text-danger mb-1">Failure notes:</p>
                      <ul className="space-y-1 list-disc list-inside">
                        {row.failNotes.map((n, i) => (
                          <li key={i}>
                            <span className="text-text">{n.notes}</span>{" "}
                            <span className="text-textMuted">— {n.tester}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}