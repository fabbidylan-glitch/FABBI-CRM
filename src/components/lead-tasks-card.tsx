"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardBody, CardHeader, Pill } from "@/components/ui";
import { formatRelative } from "@/lib/preview/fixtures";

type TaskRow = {
  id: string;
  title: string;
  dueAt: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assignee: string;
  type: "CALL" | "EMAIL" | "SMS" | "MEETING" | "REVIEW";
};

type Props = {
  leadId: string;
  tasks: TaskRow[];
  canEdit: boolean;
};

export function LeadTasksCard({ leadId, tasks, canEdit }: Props) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<TaskRow["type"]>("CALL");
  const [newPriority, setNewPriority] = useState<TaskRow["priority"]>("MEDIUM");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function markDone(taskId: string) {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    if (res.ok) router.refresh();
    else {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "Couldn't update task");
    }
  }

  async function createTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, taskType: newType, priority: newPriority }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Couldn't create task");
        return;
      }
      setNewTitle("");
      setAdding(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Tasks"
        action={
          canEdit ? (
            <button
              onClick={() => setAdding((v) => !v)}
              className="text-xs font-medium text-brand-blue hover:underline"
            >
              {adding ? "Cancel" : "+ Add"}
            </button>
          ) : null
        }
      />
      <CardBody className="space-y-3 px-5 py-3">
        {adding ? (
          <form onSubmit={createTask} className="space-y-2 rounded-md border border-brand-hairline bg-brand-blue-tint/30 p-3">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="What needs to happen?"
              className="block w-full rounded-md border border-brand-hairline bg-white px-2 py-1 text-sm text-brand-navy placeholder:text-brand-muted focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
            />
            <div className="flex items-center gap-2">
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as TaskRow["type"])}
                className="rounded-md border border-brand-hairline bg-white px-2 py-1 text-xs text-brand-navy focus:border-brand-blue focus:outline-none"
              >
                <option value="CALL">Call</option>
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
                <option value="MEETING">Meeting</option>
                <option value="REVIEW">Review</option>
              </select>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as TaskRow["priority"])}
                className="rounded-md border border-brand-hairline bg-white px-2 py-1 text-xs text-brand-navy focus:border-brand-blue focus:outline-none"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
              <button
                type="submit"
                disabled={submitting || !newTitle.trim()}
                className="ml-auto rounded-md bg-brand-blue px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
              >
                Add
              </button>
            </div>
          </form>
        ) : null}

        {err ? <div className="text-xs text-rose-700">{err}</div> : null}

        {tasks.length === 0 ? (
          <p className="text-sm text-brand-muted">No open tasks.</p>
        ) : (
          <ul className="space-y-2">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-start gap-3 rounded-md border border-brand-hairline bg-white p-2.5">
                <label className="mt-0.5 inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    onChange={() => markDone(t.id)}
                    className="h-4 w-4 rounded border-brand-hairline text-brand-blue focus:ring-brand-blue"
                  />
                </label>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-brand-navy">{t.title}</div>
                  <div className="text-xs text-brand-muted">
                    {t.assignee} · due {formatRelative(t.dueAt)}
                  </div>
                </div>
                <Pill
                  tone={t.priority === "URGENT" ? "rose" : t.priority === "HIGH" ? "amber" : "slate"}
                >
                  {t.priority}
                </Pill>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
