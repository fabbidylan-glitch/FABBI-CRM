/**
 * Runtime config flags.
 *
 * The app is designed to light up progressively:
 *   - Without any env vars, it renders static fixtures (preview mode).
 *   - With DATABASE_URL set, pages + API routes read/write real Postgres.
 *   - With Clerk keys set, routes are auth-gated.
 *   - With MS Graph vars set, outbound email sends via dylan@fabbi.co.
 *   - With Meta WA vars set, WhatsApp messages send via Cloud API.
 *
 * This lets us develop UI and share previews without every collaborator
 * having to stand up Postgres + Clerk + Azure AD + Meta Business first.
 */

export const config = {
  dbEnabled: Boolean(process.env.DATABASE_URL),
  authEnabled: Boolean(
    process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  ),
  emailEnabled:
    Boolean(process.env.RESEND_API_KEY) ||
    Boolean(
      process.env.MS_GRAPH_TENANT_ID &&
        process.env.MS_GRAPH_CLIENT_ID &&
        process.env.MS_GRAPH_CLIENT_SECRET &&
        process.env.MS_GRAPH_SENDER_MAILBOX
    ),
  whatsappEnabled: Boolean(
    process.env.META_WA_ACCESS_TOKEN && process.env.META_WA_PHONE_NUMBER_ID
  ),
  smsEnabled: Boolean(
    process.env.TELNYX_API_KEY &&
      (process.env.TELNYX_SMS_FROM || process.env.TELNYX_MESSAGING_PROFILE_ID)
  ),
  // Outbound proposal push to Anchor via Make.com. When enabled, "Send via
  // Anchor" POSTs the proposal payload to this webhook and Make creates the
  // proposal in Anchor. Inbound status updates still arrive via the separate
  // /api/public/anchor/webhook (see ANCHOR_WEBHOOK_SECRET).
  anchorOutboundEnabled: Boolean(process.env.ANCHOR_MAKE_WEBHOOK_URL),
  /** Where the "Open in Anchor" button sends reps to create a new proposal.
   *  Override if Anchor changes their URL pattern or you use a white-labeled
   *  workspace domain. */
  anchorNewProposalUrl:
    process.env.ANCHOR_NEW_PROPOSAL_URL ?? "https://app.sayanchor.com/proposals/new",
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  firmName: process.env.FIRM_NAME ?? "FABBI",
};

export type AppConfig = typeof config;
