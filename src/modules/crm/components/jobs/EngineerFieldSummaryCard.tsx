import type { EngineerFieldSummary } from "@/modules/crm/lib/engineer-field";

export function EngineerFieldSummaryCard({
  summary,
  tone = "default",
}: {
  summary: EngineerFieldSummary;
  tone?: "default" | "commsoft";
}) {
  const hasIssues = summary.blockers.length > 0 || summary.warnings.length > 0;
  const accentClass = summary.blockers.length > 0 ? "border-l-rose-500" : "border-l-emerald-500";
  const shellClass =
    tone === "commsoft"
      ? `mx-4 mb-3 rounded-2xl border border-l-4 ${accentClass} border-slate-200 bg-white p-4 shadow-sm`
      : `rounded-2xl border border-l-4 ${accentClass} border-slate-200 bg-white p-5 shadow-sm`;

  return (
    <section className={shellClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Next step</p>
          <h2 className="mt-1 text-lg font-bold text-slate-950">{summary.headline}</h2>
          <p className="mt-1 text-sm leading-5 text-slate-600">{summary.guidance}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            summary.canLeaveSite ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"
          }`}
        >
          {summary.primaryActionLabel}
        </span>
      </div>

      {hasIssues ? (
        <div className="mt-4 space-y-2">
          {summary.blockers.map((issue) => (
            <IssueRow key={issue.id} issue={issue} />
          ))}
          {summary.warnings.map((issue) => (
            <IssueRow key={issue.id} issue={issue} />
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
          Nothing is blocking this job.
        </p>
      )}
    </section>
  );
}

function IssueRow({
  issue,
}: {
  issue: EngineerFieldSummary["blockers"][number] | EngineerFieldSummary["warnings"][number];
}) {
  const isBlocker = issue.severity === "blocker";
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        isBlocker ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className={`text-sm font-semibold ${isBlocker ? "text-rose-900" : "text-amber-900"}`}>
            {issue.title}
          </p>
          <p className={`mt-0.5 text-xs leading-5 ${isBlocker ? "text-rose-700" : "text-amber-800"}`}>
            {issue.detail}
          </p>
        </div>
        <span className={`text-xs font-semibold ${isBlocker ? "text-rose-700" : "text-amber-800"}`}>
          {issue.actionLabel}
        </span>
      </div>
    </div>
  );
}
