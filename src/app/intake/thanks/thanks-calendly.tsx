"use client";

import Script from "next/script";

/**
 * Inline Calendly embed shown after a successful intake submission. Kept in its
 * own client file so the thanks page itself can stay a server component.
 * Renders nothing server-side; Calendly's widget script mounts client-side.
 */
export function ThanksCalendly({ url }: { url: string }) {
  return (
    <div className="mt-5">
      <div
        className="calendly-inline-widget"
        data-url={url}
        style={{ minWidth: "320px", height: "640px" }}
      />
      <Script
        src="https://assets.calendly.com/assets/external/widget.js"
        strategy="lazyOnload"
      />
    </div>
  );
}
