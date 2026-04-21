"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  /** Max interval between refreshes while the tab is visible. Default 30s. */
  intervalMs?: number;
};

/**
 * Keeps a server-rendered page warm: triggers router.refresh() at a fixed
 * interval while the tab is visible, plus immediately on focus / visibility
 * change / online. Paired with `export const dynamic = "force-dynamic"` on
 * the page, this makes KPIs and lists feel live without polling cost when
 * the tab is backgrounded.
 */
export function LiveRefresh({ intervalMs = 30_000 }: Props) {
  const router = useRouter();
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (interval) return;
      interval = setInterval(() => {
        router.refresh();
        setLastRefresh(new Date());
      }, intervalMs);
    }
    function stop() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    }
    function onVisibility() {
      if (document.visibilityState === "visible") {
        router.refresh();
        setLastRefresh(new Date());
        start();
      } else {
        stop();
      }
    }
    function onFocus() {
      router.refresh();
      setLastRefresh(new Date());
    }

    start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
    };
  }, [router, intervalMs]);

  return (
    <button
      type="button"
      onClick={() => {
        router.refresh();
        setLastRefresh(new Date());
      }}
      title="Click to refresh now. Auto-refreshes every 30s while visible."
      className="inline-flex items-center gap-1.5 rounded-md border border-brand-hairline bg-white px-2 py-1 text-[11px] font-medium text-brand-muted transition hover:bg-brand-blue-tint hover:text-brand-navy"
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
      </span>
      Live · updated {timeAgo(lastRefresh)}
    </button>
  );
}

function timeAgo(d: Date): string {
  const s = Math.max(1, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return `${m}m ago`;
}
