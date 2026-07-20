"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("sending");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      // Supabase's own gateway sometimes times out at ~10s while the
      // SMTP send actually completes a moment later in the background
      // — the email often arrives anyway. Don't show a raw scary error
      // for that specific case; genuine errors (bad email, real rate
      // limit) still show their actual message.
      const looksLikeTimeout =
        error.status === 504 || /timeout|timed out|fetch/i.test(error.message ?? "");
      setErrorMessage(
        looksLikeTimeout
          ? "That took longer than expected. This sometimes happens — check your inbox over the next minute, the link may still arrive even though this shows an error. If nothing comes through, try again."
          : error.message
      );
      return;
    }

    setStatus("sent");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <p className="font-mono text-xs text-accent mb-2">infra-console</p>
        <h1 className="text-xl font-semibold mb-1">Sign in</h1>
        <p className="text-sm text-textMuted mb-6">
          Enter your email. We'll send a sign-in link .
        </p>

        {status === "sent" ? (
          <p className="text-sm bg-surface border border-border rounded-md p-3">
            Check <span className="text-text">{email}</span> for a sign-in link.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-md bg-surface border border-border px-3 py-2 text-sm focus:border-accent outline-none"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-md bg-accent text-bg font-medium text-sm py-2 disabled:opacity-60"
            >
              {status === "sending" ? "Sending link…" : "Send sign-in link"}
            </button>
            {status === "error" && (
              <p className="text-sm text-danger">{errorMessage}</p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}