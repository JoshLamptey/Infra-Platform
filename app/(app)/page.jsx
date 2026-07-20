import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getModulesWithStatus } from "@/lib/moduleStatus";
import PipelineNav from "@/components/PipelineNav";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const modules = await getModulesWithStatus(supabase, user.id);

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">Curriculum pipeline</h1>
        <p className="text-sm text-textMuted mt-1">Welcome {user.email}</p>
      </header>

      {modules.length === 0 ? (
        <div className="rounded-md border border-border bg-surface p-6 text-sm text-textMuted">
          No modules found. Run <code className="text-accent">npm run seed</code> to
          load curriculum content into Supabase.
        </div>
      ) : (
        <PipelineNav modules={modules} />
      )}
    </main>
  );
}