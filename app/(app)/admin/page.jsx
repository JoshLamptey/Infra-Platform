import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/isAdmin";
import AdminModuleStatusEditor from "@/components/AdminModuleStatusEditor";
import AdminQaResults from "@/components/AdminQaResults";

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
        <h2 className="text-sm font-mono text-accent mb-3">QA results by test</h2>
        <AdminQaResults submissions={submissions ?? []} />
      </section>
    </main>
  );
}