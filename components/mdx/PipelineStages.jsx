/**
 * Usage from MDX content:
 *   <PipelineStages stages={[
 *     { name: "builder", kept: false, note: "compiler + wheels, discarded" },
 *     { name: "runtime", kept: true, note: "ships as the final image" },
 *   ]} />
 */
export default function PipelineStages({ stages = [] }) {
  return (
    <div className="my-6 overflow-x-auto">
      <div className="flex items-stretch gap-2 min-w-max pb-2">
        {stages.map((stage, index) => (
          <div key={stage.name} className="flex items-stretch">
            <div
              className={`rounded-md border px-4 py-3 min-w-[140px] ${
                stage.kept
                  ? "border-accent bg-accent/10"
                  : "border-border bg-surface border-dashed"
              }`}
            >
              <p className={`font-mono text-sm ${stage.kept ? "text-accent" : "text-textMuted"}`}>
                {stage.name}
              </p>
              <p className="text-xs text-textMuted mt-1">{stage.note}</p>
              <p className={`text-[10px] font-mono uppercase mt-2 ${stage.kept ? "text-accent" : "text-textMuted"}`}>
                {stage.kept ? "→ ships" : "✕ discarded"}
              </p>
            </div>
            {index < stages.length - 1 && (
              <div className="flex items-center px-1.5 text-textMuted" aria-hidden="true">
                →
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}