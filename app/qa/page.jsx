"use client";

import { useEffect, useState } from "react";
import { QA_TESTS } from "@/lib/qaTests";

const STORAGE_KEY = "infra-console-qa-draft-v1";

export default function QaPage() {
  const [meta, setMeta] = useState({ testerName: "", device: "", testDate: "" });
  const [results, setResults] = useState({});
  const [submitStatus, setSubmitStatus] = useState("idle"); // idle | submitting | done | error

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        setMeta(saved.meta ?? meta);
        setResults(saved.results ?? {});
      }
    } catch {
      // fresh start if the saved draft is corrupted
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ meta, results }));
    } catch {
      // storage full or blocked — not worth interrupting the tester over
    }
  }, [meta, results]);

  function setResult(id, value) {
    setResults((prev) => {
      const current = prev[id]?.result;
      return {
        ...prev,
        [id]: { result: current === value ? null : value, notes: prev[id]?.notes ?? "" },
      };
    });
  }

  function setNotes(id, notes) {
    setResults((prev) => ({ ...prev, [id]: { result: prev[id]?.result ?? null, notes } }));
  }

  const allItems = QA_TESTS.flatMap((g) => g.items);
  const done = allItems.filter((i) => results[i.id]?.result).length;
  const pass = allItems.filter((i) => results[i.id]?.result === "pass").length;
  const fail = allItems.filter((i) => results[i.id]?.result === "fail").length;

  async function handleSubmit() {
    setSubmitStatus("submitting");
    const response = await fetch("/api/qa-submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...meta, results }),
    });

    if (!response.ok) {
      setSubmitStatus("error");
      return;
    }

    setSubmitStatus("done");
    window.localStorage.removeItem(STORAGE_KEY);
  }

  if (submitStatus === "done") {
    return (
      <main className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-2xl mb-2">✅</p>
        <h1 className="text-xl font-semibold mb-2">Thanks — results submitted</h1>
        <p className="text-sm text-textMuted">You can close this page now.</p>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 pb-28">
      <h1 className="text-xl font-semibold mb-1">🧪 Infra Console — QA Checklist</h1>
      <p className="text-sm text-textMuted mb-6">
        Go through each step in order. Your answers save automatically in this browser as you go.
      </p>

      <div className="rounded-md border border-border bg-surface p-4 text-sm mb-6">
        <b className="text-accent">How to use this:</b> for each row, do the action described, compare
        what you see against &quot;should happen,&quot; then tap Pass, Fail, or N/A. If something
        doesn&apos;t match, jot down what you actually saw — more useful than Fail alone. Sections 1–8
        need no technical background. Section 9 is optional.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <input
          value={meta.testerName}
          onChange={(e) => setMeta((m) => ({ ...m, testerName: e.target.value }))}
          placeholder="Your name"
          className="rounded-md bg-surface border border-border px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={meta.testDate}
          onChange={(e) => setMeta((m) => ({ ...m, testDate: e.target.value }))}
          className="rounded-md bg-surface border border-border px-3 py-2 text-sm"
        />
        <input
          value={meta.device}
          onChange={(e) => setMeta((m) => ({ ...m, device: e.target.value }))}
          placeholder="Device / browser"
          className="rounded-md bg-surface border border-border px-3 py-2 text-sm"
        />
      </div>

      <div className="sticky top-0 z-10 bg-bg border-b border-border py-3 mb-6 flex items-center gap-3 text-xs font-mono">
        <span className="rounded-full bg-surfaceRaised px-3 py-1">{done} / {allItems.length} done</span>
        <span className="rounded-full bg-success/15 text-success px-3 py-1">{pass} pass</span>
        <span className="rounded-full bg-danger/15 text-danger px-3 py-1">{fail} fail</span>
        <div className="flex-1 h-1.5 rounded-full bg-surface overflow-hidden">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${allItems.length ? (done / allItems.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {QA_TESTS.map((group) => (
        <section key={group.section} className="mb-8">
          <h2 className="text-sm text-accent border-b border-border pb-2 mb-3">{group.section}</h2>
          <div className="space-y-3">
            {group.items.map((item) => {
              const r = results[item.id] ?? {};
              return (
                <div key={item.id} className="rounded-md border border-border bg-surface p-4">
                  <p className="text-sm mb-1"><b className="text-accent">Do this:</b> {item.action}</p>
                  <p className="text-xs text-textMuted mb-3"><b>Should happen:</b> {item.expected}</p>
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {["pass", "fail", "na"].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setResult(item.id, val)}
                        className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${
                          r.result === val
                            ? val === "pass"
                              ? "bg-success/20 border-success text-success"
                              : val === "fail"
                              ? "bg-danger/20 border-danger text-danger"
                              : "bg-past/20 border-past text-text"
                            : "bg-surfaceRaised border-border text-textMuted"
                        }`}
                      >
                        {val === "pass" ? "✅ Pass" : val === "fail" ? "❌ Fail" : "— N/A"}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={r.notes ?? ""}
                    onChange={(e) => setNotes(item.id, e.target.value)}
                    placeholder="Notes — what did you actually see? (optional)"
                    rows={2}
                    className="w-full rounded-md bg-bg border border-border px-3 py-2 text-xs resize-y"
                  />
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-bg px-4 py-3 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitStatus === "submitting" || done === 0}
          className="rounded-md bg-accent text-bg text-sm font-semibold px-6 py-2.5 disabled:opacity-50"
        >
          {submitStatus === "submitting" ? "Submitting…" : "Submit results"}
        </button>
        {submitStatus === "error" && (
          <span className="text-xs text-danger">Something went wrong — try again.</span>
        )}
      </div>
    </main>
  );
}