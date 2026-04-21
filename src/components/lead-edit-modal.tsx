"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  leadId: string;
  initial: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    companyName?: string;
    painPoint?: string;
    estimatedAnnualValue?: number;
  };
  canEdit: boolean;
};

/**
 * Click "Edit contact" → opens a modal with every editable contact field
 * pre-filled. Save → PATCH /api/leads/[id] → router.refresh() so the detail
 * page shows the new values. Phone is normalized to E.164 server-side.
 */
export function LeadEditModal({ leadId, initial, canEdit }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState(initial);
  const firstInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initial);
      setErr(null);
      // Focus first field for keyboard-first UX.
      setTimeout(() => firstInput.current?.focus(), 50);
    }
  }, [open, initial]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim() || undefined,
          lastName: form.lastName.trim() || undefined,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          companyName: form.companyName?.trim() || null,
          painPoint: form.painPoint?.trim() || null,
          estimatedAnnualValue:
            form.estimatedAnnualValue === undefined || Number.isNaN(form.estimatedAnnualValue)
              ? null
              : form.estimatedAnnualValue,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.issues?.length) {
          setErr(
            data.issues
              .map((i: { path: string; message: string }) => `${i.path}: ${i.message}`)
              .join(" · ")
          );
        } else {
          setErr(data?.error ?? "Save failed");
        }
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setErr("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={!canEdit}
        title={canEdit ? "Edit contact details" : "Sign in + connect database to edit"}
        className="rounded-md border border-brand-hairline bg-white px-2.5 py-1 text-xs font-medium text-brand-navy hover:bg-brand-blue-tint disabled:cursor-not-allowed disabled:opacity-50"
      >
        Edit contact
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-brand-hairline bg-white shadow-card-hover"
          >
            <div className="flex items-center justify-between border-b border-brand-hairline px-5 py-3">
              <h2 className="text-sm font-semibold text-brand-navy">Edit contact details</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-xs text-brand-muted hover:bg-brand-blue-tint hover:text-brand-navy"
              >
                Esc
              </button>
            </div>
            <form onSubmit={submit} className="space-y-4 px-5 py-5">
              <div className="grid grid-cols-2 gap-4">
                <Field label="First name" required>
                  <input
                    ref={firstInput}
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className={inputCls}
                    required
                  />
                </Field>
                <Field label="Last name" required>
                  <input
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className={inputCls}
                    required
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Email">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+1 555 123 4567"
                    className={inputCls}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Company">
                  <input
                    value={form.companyName ?? ""}
                    onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Estimated annual value ($)">
                  <div className="relative mt-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-brand-muted">
                      $
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={500}
                      placeholder="e.g. 48000"
                      value={form.estimatedAnnualValue ?? ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          estimatedAnnualValue:
                            e.target.value === "" ? undefined : Number(e.target.value),
                        })
                      }
                      className={`${inputCls} pl-7 mt-0`}
                    />
                  </div>
                </Field>
              </div>
              <Field label="Pain point / what they need solved">
                <textarea
                  value={form.painPoint ?? ""}
                  onChange={(e) => setForm({ ...form, painPoint: e.target.value })}
                  rows={3}
                  className={inputCls}
                />
              </Field>

              {err ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  {err}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2 border-t border-brand-hairline pt-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-brand-hairline bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-blue-tint"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-brand-blue px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

const inputCls =
  "mt-1 block w-full rounded-md border border-brand-hairline bg-white px-3 py-2 text-sm text-brand-navy placeholder:text-brand-muted focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
        {label}
        {required ? <span className="text-brand-blue"> *</span> : null}
      </span>
      {children}
    </label>
  );
}
