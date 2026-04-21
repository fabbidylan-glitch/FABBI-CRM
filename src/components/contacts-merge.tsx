"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader, Pill } from "@/components/ui";
import type { ContactSummary } from "@/lib/features/contacts/queries";

type Props = { contacts: ContactSummary[] };

export function ContactsMerge({ contacts }: Props) {
  const router = useRouter();
  const [sourceEmail, setSourceEmail] = useState("");
  const [targetEmail, setTargetEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const byEmail = useMemo(() => {
    const m = new Map<string, ContactSummary>();
    for (const c of contacts) m.set(c.email, c);
    return m;
  }, [contacts]);

  const source = sourceEmail ? byEmail.get(sourceEmail) : null;
  const target = targetEmail ? byEmail.get(targetEmail) : null;
  const canMerge =
    !!source &&
    !!target &&
    source.email !== target.email &&
    !submitting;

  async function confirmMerge() {
    if (!source || !target) return;
    if (
      !confirm(
        `Merge "${source.fullName}" (${source.leadCount} inquir${source.leadCount === 1 ? "y" : "ies"}) into "${target.fullName}"?\n\nThis re-points every inquiry and keeps all timelines + communications intact. The source contact will disappear from the Contacts list.`
      )
    )
      return;

    setSubmitting(true);
    setResult(null);
    setErr(null);
    try {
      const res = await fetch("/api/contacts/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceEmail: source.email, targetEmail: target.email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Merge failed");
        return;
      }
      setResult(
        `Moved ${data.merged} inquir${data.merged === 1 ? "y" : "ies"} from ${source.fullName} → ${target.fullName}.`
      );
      setSourceEmail("");
      setTargetEmail("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Merge contacts" />
      <CardBody>
        <p className="text-sm text-brand-muted">
          Pick two contacts that are actually the same person. Every inquiry under the{" "}
          <span className="font-semibold text-brand-navy">source</span> will re-point to the{" "}
          <span className="font-semibold text-brand-navy">target</span>. All timelines, notes, and
          communications carry over.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Picker
            label="Source (will disappear)"
            badge="source"
            badgeTone="rose"
            value={sourceEmail}
            onChange={setSourceEmail}
            contacts={contacts}
            excludeEmail={targetEmail}
          />
          <Picker
            label="Target (keeps the contact)"
            badge="target"
            badgeTone="emerald"
            value={targetEmail}
            onChange={setTargetEmail}
            contacts={contacts}
            excludeEmail={sourceEmail}
          />
        </div>

        {source && target ? (
          <div className="mt-6 rounded-lg border border-brand-hairline bg-brand-blue-tint/40 p-4 text-sm">
            <div className="font-semibold text-brand-navy">Summary</div>
            <ul className="mt-1 space-y-0.5 text-brand-navy">
              <li>
                <span className="font-medium">{source.leadCount}</span> inquir
                {source.leadCount === 1 ? "y" : "ies"} from <em>{source.fullName}</em> will move to{" "}
                <em>{target.fullName}</em>.
              </li>
              <li>
                Combined lifetime value will become{" "}
                <span className="font-medium">
                  $
                  {Math.round(
                    (source.totalEstimatedValue + target.totalEstimatedValue) * 100
                  ) / 100}
                </span>
                .
              </li>
              <li>
                Each moved lead will get a timeline note: "Contact merged: {source.email} →{" "}
                {target.email}".
              </li>
            </ul>
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-between">
          {err ? <div className="text-xs text-rose-700">{err}</div> : null}
          {result ? <div className="text-xs text-emerald-700">{result}</div> : <div />}
          <button
            onClick={confirmMerge}
            disabled={!canMerge}
            className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Merging…" : "Merge contacts"}
          </button>
        </div>
      </CardBody>
    </Card>
  );
}

function Picker({
  label,
  badge,
  badgeTone,
  value,
  onChange,
  contacts,
  excludeEmail,
}: {
  label: string;
  badge: string;
  badgeTone: "rose" | "emerald";
  value: string;
  onChange: (v: string) => void;
  contacts: ContactSummary[];
  excludeEmail: string;
}) {
  const [filter, setFilter] = useState("");
  const options = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return contacts
      .filter((c) => c.email !== excludeEmail)
      .filter((c) => {
        if (!q) return true;
        const hay = `${c.fullName} ${c.email} ${c.company ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 50);
  }, [contacts, filter, excludeEmail]);
  const selected = contacts.find((c) => c.email === value);

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-brand-muted">
          {label}
        </span>
        <Pill tone={badgeTone}>{badge}</Pill>
      </div>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search contacts…"
        className="mb-2 block w-full rounded-md border border-brand-hairline bg-white px-3 py-1.5 text-sm text-brand-navy placeholder:text-brand-muted focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
      />
      <div className="max-h-60 overflow-y-auto rounded-md border border-brand-hairline bg-white">
        {options.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-brand-muted">No matches</div>
        ) : (
          <ul>
            {options.map((c) => (
              <li key={c.email}>
                <button
                  onClick={() => onChange(c.email)}
                  className={`block w-full px-3 py-2 text-left text-xs transition ${
                    value === c.email
                      ? "bg-brand-blue-tint text-brand-blue"
                      : "text-brand-navy hover:bg-brand-blue-tint/60"
                  }`}
                >
                  <div className="font-medium">{c.fullName}</div>
                  <div className="text-[11px] text-brand-muted">
                    {c.email} · {c.leadCount} inquir{c.leadCount === 1 ? "y" : "ies"}
                    {c.company ? ` · ${c.company}` : ""}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {selected ? (
        <div className="mt-2 text-[11px] text-brand-muted">
          Selected: <span className="text-brand-navy">{selected.fullName}</span>
        </div>
      ) : null}
    </div>
  );
}
