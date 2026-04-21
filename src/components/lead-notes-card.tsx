"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui";

type Note = {
  id: string;
  body: string;
  authorName: string;
  noteType: "GENERAL" | "CALL_SUMMARY" | "MEETING_SUMMARY" | "DISCOVERY" | "INTERNAL";
  createdAt: string;
};

type Props = {
  leadId: string;
  notes: Note[];
  canEdit: boolean;
};

export function LeadNotesCard({ leadId, notes, canEdit }: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [type, setType] = useState<Note["noteType"]>("GENERAL");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, noteType: type }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Couldn't save note");
        return;
      }
      setBody("");
      setType("GENERAL");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Notes" action={<span className="text-xs text-brand-muted">{notes.length}</span>} />
      <CardBody className="space-y-4">
        {canEdit ? (
          <form onSubmit={submit} className="space-y-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="Jot down what happened on this call, what they said, what you promised…"
              className="block w-full rounded-md border border-brand-hairline bg-white px-3 py-2 text-sm text-brand-navy placeholder:text-brand-muted focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
            />
            <div className="flex items-center justify-between">
              <select
                value={type}
                onChange={(e) => setType(e.target.value as Note["noteType"])}
                className="rounded-md border border-brand-hairline bg-white px-2 py-1 text-xs text-brand-navy focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              >
                <option value="GENERAL">General</option>
                <option value="CALL_SUMMARY">Call summary</option>
                <option value="MEETING_SUMMARY">Meeting summary</option>
                <option value="DISCOVERY">Discovery</option>
                <option value="INTERNAL">Internal</option>
              </select>
              <button
                type="submit"
                disabled={submitting || !body.trim()}
                className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-blue-dark disabled:opacity-60"
              >
                {submitting ? "Saving…" : "Add note"}
              </button>
            </div>
            {err ? <div className="text-xs text-rose-700">{err}</div> : null}
          </form>
        ) : null}

        {notes.length === 0 ? (
          <p className="text-sm text-brand-muted">No notes yet.</p>
        ) : (
          <ul className="space-y-3">
            {notes.map((n) => (
              <li key={n.id} className="rounded-md border border-brand-hairline bg-brand-blue-tint/40 p-3">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-brand-muted">
                  <span>{n.authorName}</span>
                  <span>{new Date(n.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-brand-navy">{n.body}</p>
                {n.noteType !== "GENERAL" ? (
                  <span className="mt-1 inline-block text-[10px] font-semibold uppercase tracking-wide text-brand-blue">
                    {n.noteType.replace(/_/g, " ").toLowerCase()}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
