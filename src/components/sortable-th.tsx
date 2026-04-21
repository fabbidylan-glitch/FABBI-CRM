import Link from "next/link";
import type { ReactNode } from "react";
import type { LeadsSortKey } from "@/lib/features/leads/queries";

type Props = {
  column: LeadsSortKey;
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
  currentSort?: LeadsSortKey;
  currentDir?: "asc" | "desc";
  params: Record<string, string | undefined>;
};

/**
 * Server-rendered sortable <th>. Builds the target href by preserving every
 * existing filter and flipping sort direction if the column is already active.
 */
export function SortableTh({
  column,
  children,
  align = "left",
  className = "",
  currentSort,
  currentDir,
  params,
}: Props) {
  const isActive = currentSort === column;
  // Click behavior: not active → start at the column's default direction,
  // active asc → desc, active desc → back to default (no sort override).
  const defaultDir: "asc" | "desc" =
    column === "score" || column === "arr" || column === "created" ? "desc" : "asc";
  const nextDir: "asc" | "desc" | null = !isActive
    ? defaultDir
    : currentDir === defaultDir
      ? defaultDir === "desc"
        ? "asc"
        : "desc"
      : null;

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (!v) continue;
    if (k === "sort" || k === "dir") continue;
    qs.set(k, v);
  }
  if (nextDir) {
    qs.set("sort", column);
    qs.set("dir", nextDir);
  }
  const href = `/leads${qs.toString() ? `?${qs.toString()}` : ""}`;

  const alignCls = align === "right" ? "justify-end" : "justify-start";
  const arrow = !isActive ? "" : currentDir === "asc" ? "↑" : "↓";

  return (
    <th className={className}>
      <Link
        href={href}
        scroll={false}
        className={`group flex items-center gap-1 ${alignCls} text-xs uppercase tracking-wide ${
          isActive ? "text-brand-blue" : "text-brand-muted hover:text-brand-navy"
        }`}
      >
        <span>{children}</span>
        <span className={`text-[10px] ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-40"}`}>
          {arrow || "↕"}
        </span>
      </Link>
    </th>
  );
}
