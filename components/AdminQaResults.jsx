"use client";

import { useMemo, useState } from "react";
import { findTest } from "@/lib/qaTests";

function Select({ label, value, onChange, options }) {
  return (
    <label className="text-xs text-textMuted flex flex-col gap-1">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md bg-surfaceRaised border border-border text-sm px-2 py-1.5 text-text"
      >
        <option value="all">All</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </label>
  );
}

export default function AdminQaResults({ submissions }) {
  const [testerFilter, setTesterFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [deviceFilter, setDeviceFilter] = useState("all");

  const testers = useMemo(
    () => [...new Set(submissions.map((s) => s.tester_name).filter(Boolean))].sort(),
    [submissions]
  );
  const dates = useMemo(
    () => [...new Set(submissions.map((s) => s.test_date).filter(Boolean))].sort().reverse(),
    [submissions]
  );
  const devices = useMemo(
    () => [...new Set(submissions.map((s) => s.device).filter(Boolean))].sort(),
    [submissions]
  );

  const filtered = useMemo(() => {
    return submissions.filter((s) => {
      if (testerFilter !== "all" && s.tester_name !== testerFilter) return false;
      if (dateFilter !== "all" && s.test_date !== dateFilter) return false;
      if (deviceFilter !== "all" && s.device !== deviceFilter) return false;
      return true;
    });
  }, [submissions, testerFilter, dateFilter, deviceFilter]);

  // Same grouping logic as before, just re-run against whatever the
  // current filters leave — recomputes live as filters change, so this
  // has to live client-side rather than in the server component.
  const testRows = useMemo(() => {
    const byTest = {};
    for (const submission of filtered) {
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
    return Object.entries(byTest)
      .map(([testId, counts]) => ({ testId, test: findTest(testId), ...counts }))
      .filter((row) => row.test)
      .sort((a, b) => b.fail - a.fail); // worst offenders first
  }, [filtered]);

  const hasFilters = testers.length > 0 || dates.length > 0 || devices.length > 0;

  return (
    <div>
      {hasFilters && (
        <div className="flex flex-wrap items-end gap-4 mb-4">
          <Select label="Tester" value={testerFilter} onChange={setTesterFilter} options={testers} />
          <Select label="Date" value={dateFilter} onChange={setDateFilter} options={dates} />
          <Select label="Device" value={deviceFilter} onChange={setDeviceFilter} options={devices} />
          <span className="text-xs text-textMuted pb-1.5">
            {filtered.length} of {submissions.length} submission{submissions.length === 1 ? "" : "s"}
          </span>
        </div>
      )}

      {submissions.length === 0 ? (
        <p className="text-sm text-textMuted">No QA submissions yet. Share the /qa link to collect some.</p>
      ) : testRows.length === 0 ? (
        <p className="text-sm text-textMuted">No results match these filters.</p>
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
    </div>
  );
}