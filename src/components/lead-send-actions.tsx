"use client";

import { useState } from "react";

type Props = {
  leadId: string;
  phoneE164: string | null;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
  dbEnabled: boolean;
  authEnabled: boolean;
  emailTemplates: Array<{ key: string; name: string }>;
  whatsappTemplates: Array<{ key: string; name: string }>;
  smsTemplates: Array<{ key: string; name: string }>;
};

type Toast = { kind: "ok" | "err"; text: string } | null;

export function LeadSendActions(props: Props) {
  const [openPanel, setOpenPanel] = useState<"email" | "wa" | "sms" | null>(null);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const canSendReal = props.dbEnabled && props.authEnabled;

  async function send(channel: "EMAIL" | "WHATSAPP" | "SMS", templateKey: string) {
    setSending(true);
    setToast(null);
    try {
      const res = await fetch(`/api/leads/${props.leadId}/communications/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, templateKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ kind: "err", text: data.error ?? "Send failed" });
      } else {
        const label = channel === "EMAIL" ? "Email" : channel === "WHATSAPP" ? "WhatsApp" : "SMS";
        setToast({ kind: "ok", text: `${label} sent` });
        setOpenPanel(null);
      }
    } catch {
      setToast({ kind: "err", text: "Network error" });
    } finally {
      setSending(false);
    }
  }

  const telHref = props.phoneE164 ? `tel:${props.phoneE164}` : undefined;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-1.5">
        <button
          onClick={() => setOpenPanel(openPanel === "email" ? null : "email")}
          disabled={!props.emailEnabled || !canSendReal}
          title={
            !props.emailEnabled
              ? "Set MS_GRAPH_* env vars to enable email"
              : !canSendReal
                ? "Enable database + auth to send"
                : "Send email via M365"
          }
          className="rounded-md border border-brand-hairline bg-white px-2.5 py-1 text-xs text-brand-navy hover:bg-brand-blue-tint disabled:cursor-not-allowed disabled:opacity-50"
        >
          Email
        </button>
        <button
          onClick={() => setOpenPanel(openPanel === "wa" ? null : "wa")}
          disabled={!props.whatsappEnabled || !props.phoneE164 || !canSendReal}
          title={
            !props.whatsappEnabled
              ? "Set META_WA_* env vars to enable WhatsApp"
              : !props.phoneE164
                ? "Lead has no E.164 phone number"
                : !canSendReal
                  ? "Enable database + auth to send"
                  : "Send WhatsApp via Meta Cloud API"
          }
          className="rounded-md border border-brand-hairline bg-white px-2.5 py-1 text-xs text-brand-navy hover:bg-brand-blue-tint disabled:cursor-not-allowed disabled:opacity-50"
        >
          WhatsApp
        </button>
        <button
          onClick={() => setOpenPanel(openPanel === "sms" ? null : "sms")}
          disabled={!props.smsEnabled || !props.phoneE164 || !canSendReal}
          title={
            !props.smsEnabled
              ? "Set TELNYX_API_KEY + TELNYX_SMS_FROM to enable SMS"
              : !props.phoneE164
                ? "Lead has no E.164 phone number"
                : !canSendReal
                  ? "Enable database + auth to send"
                  : "Send SMS via Telnyx"
          }
          className="rounded-md border border-brand-hairline bg-white px-2.5 py-1 text-xs text-brand-navy hover:bg-brand-blue-tint disabled:cursor-not-allowed disabled:opacity-50"
        >
          SMS
        </button>
        <a
          href={telHref ?? "#"}
          aria-disabled={!telHref}
          onClick={(e) => {
            if (!telHref) e.preventDefault();
          }}
          className={`rounded-md border border-brand-hairline bg-white px-2.5 py-1 text-xs text-brand-navy hover:bg-brand-blue-tint ${
            !telHref ? "pointer-events-none opacity-50" : ""
          }`}
        >
          Call
        </a>
      </div>

      {openPanel === "email" && props.emailTemplates.length > 0 ? (
        <TemplatePicker
          label="Send email"
          items={props.emailTemplates}
          disabled={sending}
          onPick={(k) => send("EMAIL", k)}
        />
      ) : null}
      {openPanel === "wa" && props.whatsappTemplates.length > 0 ? (
        <TemplatePicker
          label="Send WhatsApp"
          items={props.whatsappTemplates}
          disabled={sending}
          onPick={(k) => send("WHATSAPP", k)}
        />
      ) : null}
      {openPanel === "sms" && props.smsTemplates.length > 0 ? (
        <TemplatePicker
          label="Send SMS"
          items={props.smsTemplates}
          disabled={sending}
          onPick={(k) => send("SMS", k)}
        />
      ) : null}

      {toast ? (
        <div
          className={`rounded-md px-2.5 py-1 text-xs ${
            toast.kind === "ok"
              ? "bg-emerald-100 text-emerald-800"
              : "bg-rose-100 text-rose-800"
          }`}
        >
          {toast.text}
        </div>
      ) : null}
    </div>
  );
}

function TemplatePicker({
  label,
  items,
  disabled,
  onPick,
}: {
  label: string;
  items: Array<{ key: string; name: string }>;
  disabled: boolean;
  onPick: (key: string) => void;
}) {
  return (
    <div className="rounded-lg border border-brand-hairline bg-white p-2 shadow-card-hover">
      <div className="px-2 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
        {label}
      </div>
      <ul className="w-56">
        {items.map((t) => (
          <li key={t.key}>
            <button
              onClick={() => onPick(t.key)}
              disabled={disabled}
              className="block w-full rounded px-2 py-1.5 text-left text-xs text-brand-navy hover:bg-brand-blue-tint disabled:opacity-50"
            >
              {t.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
