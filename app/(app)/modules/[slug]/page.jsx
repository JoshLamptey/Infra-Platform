import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypePrettyCode from "rehype-pretty-code";
import { createClient } from "@/lib/supabase/server";
import { getModule } from "@/lib/content";
import { getModulesWithStatus } from "@/lib/moduleStatus";
import Callout from "@/components/mdx/Callout";
import PipelineStages from "@/components/mdx/PipelineStages";

const mdxComponents = { Callout, PipelineStages };

const mdxOptions = {
  // next-mdx-remote v6 blocks JS expressions in MDX by default
  // (blockJS: true) to close CVE-2026-0969 — an RCE risk when MDX
  // content comes from an untrusted source. Ours never does: every
  // module's content is a file in this repo, authored by us, reviewed
  // via git, never accepted as runtime input from a user. blockJS is
  // set to false here because PipelineStages' `stages={[...]}` prop is
  // a JS expression and would otherwise be silently stripped.
  // blockDangerousJS stays at its default (true) as a costless second
  // layer — it blocks eval/Function/require/process specifically, none
  // of which any module content has a legitimate reason to reference.
  blockJS: false,
  mdxOptions: {
    remarkPlugins: [remarkGfm], // tables, strikethrough, etc. — without
    // this, react-markdown/MDX only support bare CommonMark, and the
    // comparison table further down this file was silently rendering
    // as broken literal pipe-text, not an actual table.
    rehypePlugins: [
      [rehypePrettyCode, { theme: "github-dark-dimmed", keepBackground: false }],
    ],
  },
};

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

  const quiz = moduleRow?.quizzes;

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/" className="text-xs font-mono text-textMuted hover:text-accent">
        ← pipeline
      </Link>

      <h1 className="text-2xl font-semibold mt-4 mb-6">{moduleContent.title}</h1>

      <article
        className="prose-invert max-w-none space-y-4 text-[15px] leading-relaxed
          [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-2
          [&_table]:w-full [&_table]:text-sm
          [&_th]:text-left [&_th]:border-b [&_th]:border-border [&_th]:py-1.5
          [&_td]:border-b [&_td]:border-border [&_td]:py-1.5
          [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-accent
          [&_:not(pre)>code]:bg-surfaceRaised [&_:not(pre)>code]:px-1.5
          [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:rounded [&_:not(pre)>code]:text-[13px]
          [&_pre]:bg-surface [&_pre]:border [&_pre]:border-border [&_pre]:rounded-md
          [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:my-4 [&_pre]:text-[13px] [&_pre]:leading-relaxed"
      >
        <MDXRemote source={moduleContent.body} components={mdxComponents} options={mdxOptions} />
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