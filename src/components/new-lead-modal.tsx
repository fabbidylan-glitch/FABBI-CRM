"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = {
  users: Array<{ id: string; name: string }>;
  canCreate: boolean;
};

/**
 * Internal "Add a lead" modal. Short form focused on what a rep can type fast
 * for a warm referral or inbound that didn't go through the public form.
 * Skips heavy scoring fields (property count, complexity) — the rep can fill
 * those later via "Edit contact" if useful.
 */
export function NewLeadModal({ users, canCreate }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const firstInput = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    companyName: "",
    source: "MANUAL",
    niche: "UNKNOWN",
    serviceInterest: "UNSURE",
    annualRevenueRange: "UNKNOWN",
    urgency: "UNKNOWN",
    estimatedAnnualValue: "" as string | "",
    painPoint: "",
    ownerUserId: "" as string,
    enrollInSequence: false,
  });

  useEffect(() => {
    if (open) {
      setErr(null);
      setTimeout(() => firstInput.current?.focus(), 30);
    }
  }, [open]);

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
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          companyName: form.companyName.trim() || undefined,
          source: form.source,
          niche: form.niche,
          serviceInterest: form.serviceInterest,
          annualRevenueRange: form.annualRevenueRange,
          urgency: form.urgency,
          estimatedAnnualValue:
            form.estimatedAnnualValue.trim() === ""
              ? null
              : Number(form.estimatedAnnualValue),
          painPoint: form.painPoint.trim() || undefined,
          ownerUserId: form.ownerUserId || null,
          enrollInSequence: form.enrollInSequence,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(
          data?.issues
            ? data.issues
                .map((i: { path: string; message: string }) => `${i.path}: ${i.message}`)
                .join(" · ")
            : data?.error ?? "Failed to create lead"
        );
        return;
      }
      // Navigate to the new (or matched duplicate) lead detail.
      setOpen(false);
      router.push(`/leads/${data.leadId}`);
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
        disabled={!canCreate}
        title={canCreate ? "Add a new lead manually" : "Database + auth required"}
        className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        + New lead
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
              <div>
                <h2 className="text-sm font-semibold text-brand-navy">Add a new lead</h2>
                <p className="mt-0.5 text-[11px] text-brand-muted">
                  For warm referrals, walk-ins, or any lead that didn&rsquo;t come
                  through the public intake form.
                </p>
              </div>
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
                    required
                    className={inputCls}
                  />
                </Field>
                <Field label="Last name" required>
                  <input
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    required
                    className={inputCls}
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="or leave blank if phone-only"
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
                <Field label="Company">
                  <input
                    value={form.companyName}
                    onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Source">
                  <select
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                    className={inputCls}
                  >
                    <option value="MANUAL">Manual (rep-added)</option>
                    <option value="REFERRAL">Referral</option>
                    <option value="PARTNER_REFERRAL">Partner referral</option>
                    <option value="ORGANIC_BRANDED">Organic branded</option>
                    <option value="EVENT">Event</option>
                    <option value="PODCAST">Podcast</option>
                    <option value="WEBSITE">Website</option>
                    <option value="OTHER">Other</option>
                  </select>
                </Field>
              </div>

              <details className="rounded-md border border-brand-hairline bg-brand-blue-tint/30 px-3 py-2">
                <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
                  Qualifying details (optional)
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <Field label="Niche">
                    <select
                      value={form.niche}
                      onChange={(e) => setForm({ ...form, niche: e.target.value })}
                      className={inputCls}
                    >
                      <option value="UNKNOWN">—</option>
                      <option value="STR_OWNER">STR owner</option>
                      <option value="AIRBNB_VRBO_OPERATOR">Airbnb / VRBO</option>
                      <option value="REAL_ESTATE_INVESTOR">Real estate investor</option>
                      <option value="HIGH_INCOME_STR_STRATEGY">High-income + STR</option>
                      <option value="MULTI_SERVICE_CLIENT">Multi-service</option>
                      <option value="GENERAL_SMB">General SMB</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </Field>
                  <Field label="Service interest">
                    <select
                      value={form.serviceInterest}
                      onChange={(e) => setForm({ ...form, serviceInterest: e.target.value })}
                      className={inputCls}
                    >
                      <option value="UNSURE">Unsure</option>
                      <option value="TAX_PREP">Tax prep</option>
                      <option value="BOOKKEEPING">Bookkeeping</option>
                      <option value="TAX_STRATEGY">Tax strategy</option>
                      <option value="BOOKKEEPING_AND_TAX">Bookkeeping + tax</option>
                      <option value="CFO">CFO / fractional</option>
                      <option value="FULL_SERVICE">Full-service</option>
                    </select>
                  </Field>
                  <Field label="Annual revenue">
                    <select
                      value={form.annualRevenueRange}
                      onChange={(e) => setForm({ ...form, annualRevenueRange: e.target.value })}
                      className={inputCls}
                    >
                      <option value="UNKNOWN">—</option>
                      <option value="UNDER_250K">Under $250k</option>
                      <option value="FROM_250K_TO_500K">$250k – $500k</option>
                      <option value="FROM_500K_TO_1M">$500k – $1M</option>
                      <option value="OVER_1M">$1M+</option>
                    </select>
                  </Field>
                  <Field label="Urgency">
                    <select
                      value={form.urgency}
                      onChange={(e) => setForm({ ...form, urgency: e.target.value })}
                      className={inputCls}
                    >
                      <option value="UNKNOWN">—</option>
                      <option value="NOW">Now</option>
                      <option value="NEXT_30_DAYS">Next 30 days</option>
                      <option value="RESEARCHING">Just researching</option>
                    </select>
                  </Field>
                  <Field label="Estimated annual value ($)">
                    <input
                      type="number"
                      min={0}
                      step={500}
                      value={form.estimatedAnnualValue}
                      onChange={(e) => setForm({ ...form, estimatedAnnualValue: e.target.value })}
                      placeholder="48000"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Owner">
                    <select
                      value={form.ownerUserId}
                      onChange={(e) => setForm({ ...form, ownerUserId: e.target.value })}
                      className={inputCls}
                    >
                      <option value="">Me (default)</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="mt-3">
                  <Field label="What do they need? (internal context)">
                    <textarea
                      value={form.painPoint}
                      onChange={(e) => setForm({ ...form, painPoint: e.target.value })}
                      rows={2}
                      placeholder="Referred by Mike at Doe & Co. — wants help untangling a K-1."
                      className={inputCls}
                    />
                  </Field>
                </div>
              </details>

              <label className="flex cursor-pointer items-center gap-2 text-xs text-brand-navy">
                <input
                  type="checkbox"
                  checked={form.enrollInSequence}
                  onChange={(e) => setForm({ ...form, enrollInSequence: e.target.checked })}
                  className="h-4 w-4 rounded border-brand-hairline text-brand-blue focus:ring-brand-blue"
                />
                Fire automated confirmation email + follow-up sequence
                <span className="text-brand-muted">
                  (off by default for manual adds)
                </span>
              </label>

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
                  {submitting ? "Saving…" : "Add lead"}
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
