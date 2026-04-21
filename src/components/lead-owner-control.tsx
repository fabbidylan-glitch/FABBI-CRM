"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  leadId: string;
  currentOwnerId: string | null;
  users: Array<{ id: string; name: string; email: string }>;
};

export function LeadOwnerControl({ leadId, currentOwnerId, users }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(currentOwnerId ?? "");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function save(next: string) {
    setErr(null);
    setValue(next);
    const res = await fetch(`/api/leads/${leadId}/owner`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerUserId: next || null }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "Could not change owner");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-brand-muted">Owner</dt>
      <dd className="mt-0.5">
        <select
          value={value}
          onChange={(e) => void save(e.target.value)}
          disabled={pending}
          className="w-full rounded-md border border-brand-hairline bg-white px-2 py-1 text-sm text-brand-navy focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20 disabled:opacity-60"
        >
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        {err ? <div className="mt-1 text-[11px] text-rose-700">{err}</div> : null}
      </dd>
    </div>
  );
}
