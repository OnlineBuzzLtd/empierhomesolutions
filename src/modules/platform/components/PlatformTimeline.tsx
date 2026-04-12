import { formatPlatformTimestamp, getPlatformStatusBadgeClass } from "@/modules/platform/lib/presenter";

export type PlatformTimelineItem = {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  status: string;
  meta?: string | null;
};

export function PlatformTimeline({
  items,
  emptyMessage,
}: {
  items: PlatformTimelineItem[];
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
              {item.meta ? <p className="mt-2 text-xs text-slate-500">{item.meta}</p> : null}
            </div>
            <div className="text-right">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${getPlatformStatusBadgeClass(item.status)}`}>
                {item.status}
              </span>
              <p className="mt-2 text-xs text-slate-500">{formatPlatformTimestamp(item.timestamp)}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
