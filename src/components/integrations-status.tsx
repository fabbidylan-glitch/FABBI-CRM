import { Card, CardBody, CardHeader } from "@/components/ui";
import { config } from "@/lib/config";

type Check = { name: string; on: boolean; detail: string; link?: string };

/**
 * Simple "are my integrations wired up?" panel. Tells Dylan at a glance which
 * env-gated features are active in this deployment. Calendly + Anchor sit in
 * the "via Make.com" column because they don't have native env vars — they're
 * webhooks that Make.com drives.
 */
export function IntegrationsStatus() {
  const checks: Check[] = [
    { name: "Database", on: config.dbEnabled, detail: "Neon Postgres" },
    { name: "Auth", on: config.authEnabled, detail: "Clerk" },
    { name: "Email", on: config.emailEnabled, detail: "Resend" },
    { name: "SMS", on: config.smsEnabled, detail: "Telnyx" },
    { name: "WhatsApp", on: config.whatsappEnabled, detail: "Meta Cloud API" },
    {
      name: "Calendly",
      on: Boolean(process.env.CALENDLY_DEFAULT_EVENT_URL),
      detail: "Webhook via Make.com",
      link: process.env.CALENDLY_DEFAULT_EVENT_URL,
    },
    {
      name: "Anchor",
      on: Boolean(process.env.ANCHOR_WEBHOOK_SECRET),
      detail: "Webhook via Make.com",
    },
    {
      name: "Cron",
      on: Boolean(process.env.CRON_SECRET),
      detail: "External: cron-job.org",
    },
  ];

  const onCount = checks.filter((c) => c.on).length;

  return (
    <Card>
      <CardHeader
        title="Integrations"
        action={
          <span className="text-xs text-brand-muted">
            {onCount}/{checks.length} connected
          </span>
        }
      />
      <CardBody className="px-0 py-0">
        <ul className="divide-y divide-brand-hairline">
          {checks.map((c) => (
            <li key={c.name} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden
                  className={`inline-flex h-2 w-2 shrink-0 rounded-full ${
                    c.on ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                />
                <div className="min-w-0">
                  <div className="font-medium text-brand-navy">{c.name}</div>
                  <div className="text-[11px] text-brand-muted">{c.detail}</div>
                  {c.link ? (
                    <a
                      href={c.link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 block truncate text-[11px] text-brand-blue hover:underline"
                      title={c.link}
                    >
                      {c.link}
                    </a>
                  ) : null}
                </div>
              </div>
              <span
                className={`shrink-0 text-[11px] font-medium uppercase tracking-wider ${
                  c.on ? "text-emerald-700" : "text-slate-400"
                }`}
              >
                {c.on ? "Connected" : "Not set"}
              </span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
