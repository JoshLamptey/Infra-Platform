"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Workflow, LogOut, Route, BarChart3, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AppHeader({ isAdmin = false }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function NavLink({ href, label, Icon }) {
    const isActive = pathname === href;
    return (
      <Link
        href={href}
        className={`flex items-center gap-1.5 text-sm font-mono transition-colors ${
          isActive ? "text-accent" : "text-textMuted hover:text-text"
        }`}
      >
        <Icon size={15} strokeWidth={2} aria-hidden="true" />
        {/* Text hides below sm (640px) — icons alone are enough to stay
            usable on a phone width without everything crowding together. */}
        <span className="hidden sm:inline">{label}</span>
      </Link>
    );
  }

  return (
    <header className="border-b border-border">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2 shrink-0 min-w-0">
          <Workflow size={18} strokeWidth={2} className="text-accent shrink-0" aria-hidden="true" />
          <span className="font-mono text-sm text-text truncate">infra-console</span>
        </Link>

        <nav className="flex items-center gap-3 sm:gap-5 shrink-0" aria-label="Main">
          <NavLink href="/" label="pipeline" Icon={Route} />
          <NavLink href="/analytics" label="analytics" Icon={BarChart3} />
          {isAdmin && <NavLink href="/admin" label="admin" Icon={ShieldCheck} />}
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-sm font-mono text-textMuted hover:text-danger transition-colors"
          >
            <LogOut size={15} strokeWidth={2} aria-hidden="true" />
            <span className="hidden sm:inline">sign out</span>
          </button>
        </nav>
      </div>
    </header>
  );
}