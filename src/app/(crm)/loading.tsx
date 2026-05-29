export default function CrmLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="space-y-2">
        <div className="h-7 w-56 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-slate-100" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-24 animate-pulse rounded-lg border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-14 animate-pulse rounded bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
