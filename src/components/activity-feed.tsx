import Link from "next/link";
import { Card, CardBody, CardHeader, RawPill } from "@/components/ui";
import type { ActivityItem } from "@/lib/features/activity/queries";
import { formatRelative, gradeColor } from "@/lib/preview/fixtures";

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <Card>
      <CardHeader title="Activity" action={<span className="text-xs text-brand-muted">Last {items.length} events</span>} />
      <CardBody className="px-0 py-0">
        {items.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-brand-muted">
            No activity yet. Submit a lead at <code>/intake</code> to see events flow in.
          </div>
        ) : (
          <ul className="divide-y divide-brand-hairline">
            {items.map((e) => (
              <li key={e.id} className="px-5 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/leads/${e.leadId}`}
                        className="truncate text-sm font-medium text-brand-navy hover:text-brand-blue"
                      >
                        {e.leadName}
                      </Link>
                      <RawPill className={gradeColor(e.leadGrade)}>{e.leadGrade}</RawPill>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-muted">
                        {e.eventType.replace(/_/g, " ").toLowerCase()}
                      </span>
                    </div>
                    <div className="truncate text-xs text-slate-700">{e.title}</div>
                  </div>
                  <div className="shrink-0 text-right text-[11px] text-brand-muted">
                    <div>{e.actor}</div>
                    <div>{formatRelative(e.at)}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
