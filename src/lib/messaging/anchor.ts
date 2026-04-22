import "server-only";

/**
 * Outbound proposal push to Anchor via Make.com.
 *
 * Anchor has no public REST API, so we use Make.com as the bridge:
 *   CRM → POST ANCHOR_MAKE_WEBHOOK_URL → Make.com scenario → Anchor "Create
 *   Proposal" action.
 *
 * Reconciliation:
 *   - Before sending, the caller writes an `externalProposalId` onto the
 *     Proposal row (format: `crm:<cuid>`) and includes it in the payload.
 *   - The user's Make scenario must forward that ID back on subsequent
 *     Anchor events (viewed / accepted / declined) via our inbound webhook.
 *     The inbound endpoint uses `externalProposalId` to locate the right
 *     Proposal row.
 *
 * Failure policy:
 *   - This function returns `{ ok: false, error }` rather than throwing, so
 *     the send endpoint can surface a clear error in the UI without falsely
 *     marking the proposal as SENT.
 */

export type AnchorPushPayload = {
  externalProposalId: string;
  proposalInternalId: string;
  lead: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    companyName: string | null;
  };
  servicePackage: string | null;
  scopeSummary: string | null;
  monthlyTotal: number;
  onetimeTotal: number;
  annualValue: number;
  lineItems: Array<{
    kind: string;
    description: string;
    monthlyAmount: number | null;
    onetimeAmount: number | null;
    quantity: number;
  }>;
  sender: {
    name: string | null;
    email: string | null;
  };
};

export type AnchorPushResult =
  | { ok: true; makeResponse: unknown }
  | { ok: false; error: string; status?: number };

export async function pushProposalToAnchor(
  payload: AnchorPushPayload
): Promise<AnchorPushResult> {
  const url = process.env.ANCHOR_MAKE_WEBHOOK_URL;
  if (!url) {
    return { ok: false, error: "ANCHOR_MAKE_WEBHOOK_URL not configured" };
  }

  // Guard against sending test/local URLs to a real Make scenario by accident
  // — Make webhook URLs always start with https://hook.
  if (!/^https:\/\/hook\.(eu\d+|us\d+)\.make\.com\//.test(url)) {
    // Don't block — just warn. Users may proxy this through their own edge.
    console.warn("[anchor] webhook URL doesn't match Make's host pattern");
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Let the user's Make scenario authenticate the request if desired.
        ...(process.env.ANCHOR_MAKE_WEBHOOK_SECRET
          ? { "x-crm-secret": process.env.ANCHOR_MAKE_WEBHOOK_SECRET }
          : {}),
      },
      body: JSON.stringify({ event: "proposal.create", ...payload }),
      // Make scenarios that call external APIs can take 5-15s; give it room.
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      return {
        ok: false,
        status: res.status,
        error: `Make webhook returned ${res.status}: ${bodyText.slice(0, 240)}`,
      };
    }

    // Make usually returns "Accepted" as plain text; if the scenario is set
    // to return JSON we'll capture it for debugging / ID reconciliation.
    const contentType = res.headers.get("content-type") ?? "";
    const makeResponse = contentType.includes("application/json")
      ? await res.json().catch(() => null)
      : await res.text().catch(() => null);

    return { ok: true, makeResponse };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: `Push to Make.com failed: ${message}` };
  }
}
