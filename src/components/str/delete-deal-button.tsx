"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteDealButton({
  dealId,
  dealName,
}: {
  dealId: string;
  dealName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (
      !confirm(
        `Delete "${dealName}"? This permanently removes the deal, scenarios, comps, and memos.`
      )
    ) {
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/str-deals/${dealId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/str-deals");
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Delete failed");
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={busy}
      className="rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
    >
      {busy ? "Deleting…" : "Delete deal"}
    </button>
  );
}
