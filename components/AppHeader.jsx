"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Workflow, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function NavLink({ href, label }) {
    const isActive = pathname === href;
    return (
      <Link
        href={href}
        className={`text-sm font-mono transition-colors ${
          isActive ? "text-accent" : "text-textMuted hover:text-text"
        }`}
      >
        {label}
      </Link>
    );
  }

  return (
    <header className="border-b border-border">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Workflow size={18} strokeWidth={2} className="text-accent" aria-hidden="true" />
          <span className="font-mono text-sm text-text">infra-console</span>
        </Link>

        <nav className="flex items-center gap-5" aria-label="Main">
          <NavLink href="/" label="pipeline" />
          <NavLink href="/analytics" label="analytics" />
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-sm font-mono text-textMuted hover:text-danger transition-colors"
          >
            <LogOut size={14} strokeWidth={2} aria-hidden="true" />
            sign out
          </button>
        </nav>
      </div>
    </header>
  );
}