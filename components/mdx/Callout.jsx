const VARIANTS = {
  info: { border: "border-accent/50", bg: "bg-accent/10", label: "Note", labelColor: "text-accent" },
  why: { border: "border-accent/50", bg: "bg-accent/10", label: "Why it matters", labelColor: "text-accent" },
  warning: { border: "border-danger/50", bg: "bg-danger/10", label: "Watch out", labelColor: "text-danger" },
};

/**
 * Usage from MDX content:
 *   <Callout variant="why">Some explanation...</Callout>
 * variant defaults to "info" if omitted.
 */
export default function Callout({ variant = "info", children }) {
  const style = VARIANTS[variant] ?? VARIANTS.info;

  return (
    <div className={`rounded-md border ${style.border} ${style.bg} px-4 py-3 my-4`}>
      <p className={`text-xs font-mono uppercase tracking-wide mb-1.5 ${style.labelColor}`}>
        {style.label}
      </p>
      <div className="text-sm text-text leading-relaxed [&>p]:m-0">{children}</div>
    </div>
  );
}