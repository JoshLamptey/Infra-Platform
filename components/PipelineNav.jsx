import Link from "next/link";
import { Lock, LockOpen } from "lucide-react";

const STATE_STYLES = {
  locked: {
    border: "border-border",
    bg: "bg-surface/40",
    icon: "text-locked",
    title: "text-locked",
    meta: "text-locked",
  },
  active: {
    border: "border-accent",
    bg: "bg-surface",
    icon: "text-accent",
    title: "text-text",
    meta: "text-accent",
  },
  past: {
    border: "border-border",
    bg: "bg-surface/60",
    icon: "text-past",
    title: "text-past",
    meta: "text-past",
  },
};

function formatDate(dateString) {
  if (!dateString) return null;
  return new Date(dateString + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function WeekCard({ module }) {
  const styles = STATE_STYLES[module.lockState];
  const isLocked = module.lockState === "locked";
  const weekLabel = `Week ${module.orderIndex}`;
  const dateLabel = formatDate(module.scheduledDate);

  const content = (
    <div
      className={`flex items-center gap-4 rounded-lg border px-4 py-3.5 transition-colors ${styles.border} ${styles.bg} ${
        isLocked ? "cursor-not-allowed" : "hover:border-accentStrong"
      }`}
    >
      <span className={`shrink-0 ${styles.icon}`} aria-hidden="true">
        {isLocked ? <Lock size={18} strokeWidth={2} /> : <LockOpen size={18} strokeWidth={2} />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className={`font-mono text-xs ${styles.meta}`}>{weekLabel}</span>
          {dateLabel && <span className={`font-mono text-xs ${styles.meta}`}>· {dateLabel}</span>}
        </div>
        <p className={`text-sm font-medium truncate ${styles.title}`}>{module.title}</p>
      </div>

      <div className="shrink-0 text-right">
        {module.lockState === "active" && module.needsReview && (
          <span className="rounded-full bg-pending/15 text-pending text-xs font-mono px-2 py-1">
            needs review
          </span>
        )}
        {module.lockState === "active" && !module.needsReview && (
          <span className="rounded-full bg-accent/15 text-accent text-xs font-mono px-2 py-1">
            in progress
          </span>
        )}
        {module.lockState === "past" && module.avgScorePct !== null && (
          <span className="rounded-full bg-past/15 text-past text-xs font-mono px-2 py-1">
            {module.avgScorePct}%
          </span>
        )}
        {isLocked && (
          <span className="text-locked text-xs font-mono">locks until taught</span>
        )}
      </div>
    </div>
  );

  if (isLocked) {
    return (
      <li title="Unlocks once this session is taught">
        <span className="sr-only">Locked. Unlocks once this session is taught.</span>
        {content}
      </li>
    );
  }

  return (
    <li>
      <Link href={`/modules/${module.slug}`} className="block">
        {content}
      </Link>
    </li>
  );
}

/**
 * Weekly pipeline: past sessions are grayed out but reviewable, the
 * active session is highlighted and open, and anything not yet taught
 * is locked and non-interactive — a padlock, not a link.
 */
export default function PipelineNav({ modules }) {
  return (
    <nav aria-label="Curriculum pipeline">
      <ol className="space-y-2.5">
        {modules.map((module) => (
          <WeekCard key={module.slug} module={module} />
        ))}
      </ol>
    </nav>
  );
}