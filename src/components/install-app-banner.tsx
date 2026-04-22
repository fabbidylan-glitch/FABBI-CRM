"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Prompt mobile users to install the PWA the first time they visit on a
 * phone. Dismissals are persisted in localStorage so we don't nag.
 *
 * Behavior by platform:
 *   - Android Chrome / Edge: we catch the `beforeinstallprompt` event, hide
 *     our banner in favor of the browser's native install prompt when the
 *     user taps Install.
 *   - iOS Safari: no native prompt available, so we show instructions
 *     ("tap Share, then Add to Home Screen") since that's the only path.
 *   - Desktop / already-installed: banner stays hidden.
 */
const DISMISS_KEY = "fabbi-pwa-install-dismissed";

export function InstallAppBanner() {
  const [state, setState] = useState<
    | { kind: "hidden" }
    | { kind: "android"; event: BeforeInstallPromptEvent }
    | { kind: "ios" }
  >({ kind: "hidden" });

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already installed? standalone display mode OR iOS-specific flag.
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    // Dismissed in the last 30 days? Leave alone.
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed) {
        const when = Number(dismissed);
        if (!Number.isNaN(when) && Date.now() - when < 30 * 24 * 3600 * 1000) return;
      }
    } catch {
      // localStorage unavailable — proceed anyway.
    }

    const ua = navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/.test(ua) && !/(CriOS|FxiOS|EdgiOS)/.test(ua);

    if (isIos) {
      setState({ kind: "ios" });
      return;
    }

    // Android path — wait for the browser's signal.
    const handler = (e: Event) => {
      e.preventDefault();
      setState({ kind: "android", event: e as BeforeInstallPromptEvent });
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setState({ kind: "hidden" });
  }

  async function install() {
    if (state.kind !== "android") return;
    await state.event.prompt();
    await state.event.userChoice;
    dismiss();
  }

  if (state.kind === "hidden") return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 rounded-xl border border-brand-hairline bg-white/95 p-3 shadow-card-hover backdrop-blur-md sm:left-auto sm:right-4 sm:w-80">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-blue to-brand-blue-dark text-sm font-bold text-white shadow-[inset_0_1px_0_0_rgb(255_255_255/0.2)]"
        >
          F
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-brand-navy">Install FABBI</div>
          <div className="mt-0.5 text-[11px] text-brand-muted">
            {state.kind === "ios" ? (
              <>
                Tap the <strong>Share</strong> icon, then <strong>Add to Home Screen</strong>.
              </>
            ) : (
              <>Full-screen app on your home screen — faster than the browser.</>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            {state.kind === "android" ? (
              <button
                type="button"
                onClick={install}
                className="rounded-md bg-brand-blue px-3 py-1 text-[11px] font-semibold text-white shadow-btn-primary hover:bg-brand-blue-dark"
              >
                Install
              </button>
            ) : null}
            <button
              type="button"
              onClick={dismiss}
              className="rounded-md border border-brand-hairline bg-white px-3 py-1 text-[11px] font-medium text-brand-navy hover:bg-brand-blue-tint"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
