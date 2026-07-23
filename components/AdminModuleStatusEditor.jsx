"use client";

import { useState } from "react";

const STATUS_LABELS = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

export default function AdminModuleStatusEditor({ modules }) {
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [localStatus, setLocalStatus] = useState(
    Object.fromEntries(modules.map((m) => [m.id, m.status]))
  );

  async function handleChange(moduleId, status) {
    setLocalStatus((prev) => ({ ...prev, [moduleId]: status }));
    setSavingId(moduleId);
    setSavedId(null);

    const response = await fetch("/api/admin/update-module-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleId, status }),
    });

    setSavingId(null);
    if (response.ok) {
      setSavedId(moduleId);
      setTimeout(() => setSavedId(null), 1500);
    }
  }

  return (
    <div className="space-y-2">
      {modules.map((module) => (
        <div
          key={module.id}
          className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-4 py-2.5"
        >
          <div className="min-w-0">
            <p className="text-sm truncate">{module.title}</p>
            <p className="text-xs text-textMuted font-mono">Week {module.order_index}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {savingId === module.id && (
              <span className="text-xs text-textMuted">saving…</span>
            )}
            {savedId === module.id && (
              <span className="text-xs text-success">saved</span>
            )}
            <select
              value={localStatus[module.id]}
              onChange={(e) => handleChange(module.id, e.target.value)}
              className="rounded-md bg-surfaceRaised border border-border text-sm px-2 py-1.5"
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}