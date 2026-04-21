import { Card, CardBody, CardHeader, Pill } from "@/components/ui";
import { computeStaleness, humanHours } from "@/lib/features/leads/sla";
import { STAGE_LABEL, formatRelative, type Grade, type Stage } from "@/lib/preview/fixtures";
import Link from "next/link";

/**
 * Close-probability model — base by stage, then multiplied by grade. An A-
 * grade in PROPOSAL_SENT closes roughly 1.25× a typical lead; a D-grade
 * closes about 0.4×. Multiplier is clamped to [0, 1].
 */
const BASE_CLOSE_PROBABILITY: Record<Stage, number> = {
  NEW_LEAD: 0.05,
  CONTACTED: 0.1,
  QUALIFIED: 0.2,
  CONSULT_BOOKED: 0.35,
  CONSULT_COMPLETED: 0.5,
  PROPOSAL_DRAFTING: 0.6,
  PROPOSAL_SENT: 0.7,
  FOLLOW_UP_NEGOTIATION: 0.8,
  WON: 1,
  LOST: 0,
  COLD_NURTURE: 0.05,
};

const GRADE_MULTIPLIER: Record<Grade, number> = {
  A: 1.25,
  B: 1.0,
  C: 0.7,
  D: 0.4,
};

type Props = {
  stage: Stage;
  grade: Grade;
  lastStageChangeAt?: string | null;
  nextTaskTitle?: string;
  nextTaskDueAt?: string;
  nextTaskId?: string;
  ownerName?: string | null;
  estimatedAnnualValue?: number | null;
  phoneE164?: string | null;
  email?: string | null;
  /** Has the lead replied since our last outbound? Flips recommendations. */
  hasUnansweredInbound?: boolean;
};

/**
 * Surface the single most important thing to do on this lead right now.
 * Answers four operator questions in one glance:
 *   1. What stage am I in + how long have I been here?
 *   2. What's my close probability?
 *   3. What's my weighted value to the business?
 *   4. What should I do next?
 */
export function LeadNextAction(props: Props) {
  const { level, hours } = computeStaleness(props.stage, props.lastStageChangeAt);
  const probability = Math.min(
    1,
    BASE_CLOSE_PROBABILITY[props.stage] * GRADE_MULTIPLIER[props.grade]
  );
  const weighted = props.estimatedAnnualValue
    ? Math.round(props.estimatedAnnualValue * probability)
    : null;

  const recommendation = buildRecommendation(props, level, hours);

  return (
    <Card>
      <CardHeader
        title="Next action"
        action={
          <Pill tone={level === "stale" ? "rose" : level === "slow" ? "amber" : "emerald"}>
            {level === "stale"
              ? `${humanHours(hours)} in stage — overdue`
              : level === "slow"
                ? `${humanHours(hours)} in stage — slow`
                : `${humanHours(hours)} in stage`}
          </Pill>
        }
      />
      <CardBody className="space-y-3">
        <p className="text-sm font-medium text-brand-navy">{recommendation.title}</p>
        {recommendation.detail ? (
          <p className="text-xs text-brand-muted">{recommendation.detail}</p>
        ) : null}

        {recommendation.cta ? (
          <div className="flex flex-wrap gap-2">
            {recommendation.cta.map((a, i) =>
              a.href ? (
                <a
                  key={i}
                  href={a.href}
                  target={a.href.startsWith("http") ? "_blank" : undefined}
                  rel={a.href.startsWith("http") ? "noreferrer" : undefined}
                  className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-blue-dark"
                >
                  {a.label}
                </a>
              ) : (
                <span
                  key={i}
                  className="rounded-md border border-brand-hairline bg-white px-3 py-1.5 text-xs font-medium text-brand-navy"
                >
                  {a.label}
                </span>
              )
            )}
          </div>
        ) : null}

        <dl className="mt-2 grid grid-cols-3 gap-3 border-t border-brand-hairline pt-3 text-xs">
          <div>
            <dt className="uppercase tracking-wider text-brand-muted">Stage</dt>
            <dd className="mt-0.5 font-medium text-brand-navy">{STAGE_LABEL[props.stage]}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wider text-brand-muted">Close prob.</dt>
            <dd className="mt-0.5 font-medium text-brand-navy tabular-nums">
              {Math.round(probability * 100)}%
            </dd>
          </div>
          <div>
            <dt className="uppercase tracking-wider text-brand-muted">Weighted</dt>
            <dd className="mt-0.5 font-medium text-brand-navy tabular-nums">
              {weighted !== null ? `$${weighted.toLocaleString()}` : "—"}
            </dd>
          </div>
        </dl>

        {props.nextTaskTitle && props.nextTaskDueAt ? (
          <div className="rounded-md border border-brand-hairline bg-brand-blue-tint/40 px-3 py-2 text-xs">
            <div className="font-semibold text-brand-navy">Open task</div>
            <div className="mt-0.5 text-brand-navy">{props.nextTaskTitle}</div>
            <div className="text-brand-muted">
              {props.ownerName ? `${props.ownerName} · ` : ""}due {formatRelative(props.nextTaskDueAt)}
            </div>
          </div>
        ) : null}

        {!props.ownerName ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <span className="font-semibold">Unassigned.</span> Pick an owner in the Owner field
            above so this lead shows up in someone&rsquo;s queue.
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

type Rec = {
  title: string;
  detail?: string;
  cta?: Array<{ label: string; href?: string }>;
};

function buildRecommendation(
  props: Props,
  level: "fresh" | "slow" | "stale",
  hours: number
): Rec {
  const telHref = props.phoneE164 ? `tel:${props.phoneE164}` : undefined;
  const mailto = props.email ? `mailto:${props.email}` : undefined;

  // Reply-aware override: if the prospect has sent us something since our
  // last outbound, the priority is NOT "send another nudge" — it's "reply to
  // them" or "get on a call." Short-circuit the stage-based logic.
  if (props.hasUnansweredInbound) {
    return {
      title: "They replied — respond now, don't auto-send.",
      detail:
        "Check Communications below. A human reply within 5 minutes of an inbound beats any templated nudge.",
      cta: [
        ...(telHref ? [{ label: "Call now", href: telHref }] : []),
        ...(mailto ? [{ label: "Reply by email", href: mailto }] : []),
      ],
    };
  }

  const stale = level === "stale";
  const slow = level === "slow";

  switch (props.stage) {
    case "NEW_LEAD":
      return {
        title: stale
          ? "First-touch SLA missed — call immediately."
          : "Call within 5 minutes — A-lead SLA.",
        detail: `Lead landed ${humanHours(hours)} ago. The first rep to call a fresh lead wins ~100× more often.`,
        cta: [
          telHref ? { label: "Call now", href: telHref } : { label: "No phone on file" },
          mailto ? { label: "Email", href: mailto } : { label: "No email on file" },
        ],
      };
    case "CONTACTED":
      return {
        title: "Confirm fit and push to a booked consult.",
        detail:
          "Follow up with the booking link. If they've gone cold for 3+ days, try a different channel (SMS/WhatsApp).",
        cta: telHref ? [{ label: "Call", href: telHref }] : undefined,
      };
    case "QUALIFIED":
      return {
        title: slow || stale
          ? "Qualified — send them the booking link NOW."
          : "Qualified — invite them to a consult.",
        detail: "Use the Email button with the 'Qualified — schedule consult' template.",
      };
    case "CONSULT_BOOKED":
      return {
        title: "Prep and show up.",
        detail:
          "Review niche, revenue, and pain point. After the meeting, use Showed up / No show to update the record.",
      };
    case "CONSULT_COMPLETED":
      return {
        title: "Draft the proposal in Anchor within 48h.",
        detail: "Consults that don't get a proposal within 48h convert 3× less often.",
      };
    case "PROPOSAL_DRAFTING":
      return {
        title: "Send the proposal today.",
        detail: "Once it's in Anchor, hit send and move the stage to Proposal Sent.",
      };
    case "PROPOSAL_SENT":
      return {
        title: stale
          ? "Proposal is stale — escalate to a call."
          : "Follow up in 2 days if they don't reply.",
        detail: "Auto-created follow-up task is below. Hit it — don't let proposals rot.",
        cta: telHref ? [{ label: "Call now", href: telHref }] : undefined,
      };
    case "FOLLOW_UP_NEGOTIATION":
      return {
        title: "Close the deal — get on a call.",
        detail: "Push through objections. This is the moment that separates Won from Lost.",
        cta: telHref ? [{ label: "Call now", href: telHref }] : undefined,
      };
    case "WON":
      return {
        title: "Kick off onboarding.",
        detail: "Welcome email and doc collection tasks have been auto-created.",
        cta: [{ label: "See onboarding tasks below" }],
      };
    case "LOST":
      return {
        title: "Archived. Add to nurture if they might come back.",
      };
    case "COLD_NURTURE":
      return {
        title: "Drip content monthly.",
        detail: "No active sequence — send case studies and tax-planning reminders.",
      };
  }
}

export function closeProbabilityFor(stage: Stage): number {
  return BASE_CLOSE_PROBABILITY[stage];
}
