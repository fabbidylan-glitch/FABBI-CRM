# FABBI CRM

Internal lead operations + automation system for FABBI — purpose-built for a high-ticket
accounting, bookkeeping, and tax strategy firm serving short-term rental owners and real
estate investors.

> **Status:** Phase 1A complete. Schema, seed data, brand theme (FABBI navy +
> `#005bf7`), and four working pages (Dashboard, Leads list, Lead detail, Pipeline)
> are live and wired to Prisma with automatic fixture fallback. Lead intake API
> (`POST /api/public/lead`) and public intake form (`/intake`) accept real
> submissions. Clerk auth is installed and gates every route except `/intake` and
> `/api/public/*` — it activates automatically once keys are present. Automation
> engine, Calendly/Twilio/Ignition adapters, and admin rule editor are still ahead.

---

## Preview mode (zero setup)

The fastest way to see the product. No database or env vars required.

```bash
cd fabbi-crm
npm install
npm run dev
```

Then open <http://localhost:3000>. You'll land on the Dashboard; the sidebar navigates
to **Leads** and **Pipeline**. Click any lead name to open the detail view (score
breakdown, timeline, communications log, tasks, attribution).

All data in preview mode is static — sourced from [src/lib/preview/fixtures.ts](src/lib/preview/fixtures.ts),
which mirrors `prisma/seed.ts`. Nothing writes back. Once Phase 1 wires the UI to
Prisma, the fixtures module goes away.

> If `npm install` prints a Prisma warning about `DATABASE_URL` not being set, you can
> ignore it — Prisma just generates the client, and the preview UI doesn't touch the
> database.

---

## Stack

- **Frontend + API:** [Next.js 15](https://nextjs.org/) (App Router) + TypeScript
- **UI (planned):** Tailwind CSS + shadcn/ui
- **Data fetching (planned):** TanStack Query
- **ORM:** Prisma 5
- **Database:** PostgreSQL 15+
- **Auth (planned):** Clerk _or_ NextAuth (decide before Phase 1 starts)
- **Background jobs (planned):** Upstash QStash _or_ Trigger.dev
- **Transactional email (planned):** Resend _or_ SendGrid (abstraction layer)
- **SMS / WhatsApp (planned):** Twilio
- **Analytics (planned):** PostHog + dashboard queries
- **Hosting:** Vercel (app) + managed Postgres (Supabase / Neon / RDS)
- **Monitoring:** Sentry + structured server logs

Architecture principle: **modular monolith** — single Next.js app, strong feature
boundaries, no premature microservices.

---

## Folder structure

```txt
fabbi-crm/
├─ prisma/
│  ├─ schema.prisma        # full data model
│  └─ seed.ts              # realistic FABBI-niche seed data
├─ src/
│  ├─ app/                 # Next.js App Router entrypoint
│  ├─ components/          # shared UI primitives
│  ├─ features/            # domain modules (Phase 1+ work lands here)
│  │  ├─ leads/
│  │  ├─ pipeline/
│  │  ├─ automations/
│  │  ├─ proposals/
│  │  ├─ analytics/
│  │  └─ admin/
│  ├─ lib/
│  │  ├─ auth/             # Clerk/NextAuth wrapper
│  │  ├─ db/               # Prisma client singleton
│  │  ├─ integrations/
│  │  │  ├─ calendly/
│  │  │  ├─ ignition/
│  │  │  ├─ twilio/
│  │  │  ├─ keeper/
│  │  │  ├─ double/
│  │  │  └─ email/
│  │  ├─ messaging/        # template rendering + channel abstraction
│  │  ├─ scoring/          # rules-based scoring engine
│  │  ├─ rules/            # admin-editable rule loader
│  │  ├─ validators/       # Zod schemas for API boundaries
│  │  └─ telemetry/        # logging + Sentry wiring
│  └─ types/
├─ jobs/                   # background job handlers
├─ .env.example
├─ next.config.mjs
├─ package.json
├─ postcss.config.mjs
├─ tailwind.config.ts
└─ tsconfig.json
```

---

## Prerequisites

- Node.js 20+
- pnpm, npm, or yarn (examples below use `npm`)
- PostgreSQL 15+ running locally, _or_ a connection string from Supabase / Neon / RDS

---

## Progressive setup

The app is designed to light up gradually — each piece you configure unlocks more
functionality, and the parts you skip keep rendering fixtures:

| You have set                                                       | What works                                                        |
| ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| _(nothing — just `npm install`)_                                   | Full UI tour off static fixtures. Intake form echoes a score.      |
| `DATABASE_URL` + `DIRECT_DATABASE_URL`                             | Pages query real Postgres. Intake form persists leads + events.    |
| `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`           | Middleware gates every route except `/intake` and `/api/public/*`. |
| All of the above                                                   | Production-ready Phase 1A.                                         |

### 1. Database — Neon recommended (2 min, free)

1. Sign up at <https://neon.tech> and create a new project.
2. Copy both the **pooled** and **direct** connection strings.
3. In `.env`, set:
   ```env
   DATABASE_URL="postgresql://...pooler.neon.tech/..."
   DIRECT_DATABASE_URL="postgresql://...neon.tech/..."   # non-pooled
   ```
4. Create the schema and seed data:
   ```bash
   npm run db:generate
   npm run db:migrate -- --name init
   npm run db:seed
   ```

### 2. Auth — Clerk (5 min)

1. Sign up at <https://clerk.com> and create a new application.
2. In `.env`, set:
   ```env
   CLERK_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   ```
3. Restart the dev server. All pages except `/intake`, `/api/public/*`, `/sign-in`,
   and `/sign-up` now require a signed-in user.

### 3. Email — Microsoft 365 Graph (send as dylan@fabbi.co)

Register an Azure AD app with **application-scope** `Mail.Send`, then restrict it
to a single mailbox so it can only impersonate that one inbox.

1. **Register app**
   - Azure Portal → **Entra ID** → App registrations → **New registration**.
   - Name: "FABBI CRM — Outbound Email". Supported account types: single tenant.
2. **Permissions**
   - API permissions → **Add** → Microsoft Graph → **Application permissions** → `Mail.Send` → Add.
   - **Grant admin consent** for the tenant.
3. **Client secret**
   - Certificates & secrets → New client secret. Copy the **value** (you only see it once).
4. **Scope the app to one mailbox** (so it can't send as anyone else)

   In Exchange Online PowerShell:

   ```powershell
   Connect-ExchangeOnline -UserPrincipalName dylan@fabbi.co
   New-DistributionGroup -Name "FABBI CRM Senders" -Members dylan@fabbi.co -Type Security
   New-ApplicationAccessPolicy `
     -AppId <APPLICATION_CLIENT_ID> `
     -PolicyScopeGroupId "FABBI CRM Senders" `
     -AccessRight RestrictAccess `
     -Description "FABBI CRM — mailbox restriction"
   ```

5. **Paste keys**
   ```env
   MS_GRAPH_TENANT_ID=<directory (tenant) id>
   MS_GRAPH_CLIENT_ID=<application (client) id>
   MS_GRAPH_CLIENT_SECRET=<secret value>
   MS_GRAPH_SENDER_MAILBOX=dylan@fabbi.co
   ```

6. Restart the dev server. The **Email** button on the lead detail page
   un-grays; picking a template sends via Graph and logs a `Communication` row.

### 4. WhatsApp — Meta Cloud API

1. **Create the app**
   - <https://developers.facebook.com/apps/> → Create App → "Business" type.
   - Add product → **WhatsApp**.
2. **Link your WhatsApp Business Account + phone number** in the WhatsApp panel.
   Note the **Phone Number ID** and **WhatsApp Business Account ID**.
3. **Access token**
   - Business Settings → System Users → create one → generate a **permanent token**
     with `whatsapp_business_messaging` + `whatsapp_business_management` scopes.
4. **Webhook**
   - In the WhatsApp → Configuration panel, set:
     - Callback URL: `https://<your-host>/api/public/whatsapp/webhook`
       (for local dev, use an ngrok tunnel).
     - Verify token: any random string, pasted as `META_WA_VERIFY_TOKEN` in `.env`.
   - Subscribe to `messages` and `message_status` fields.
5. **Paste keys**
   ```env
   META_WA_ACCESS_TOKEN=<permanent token>
   META_WA_PHONE_NUMBER_ID=<phone number id>
   META_WA_BUSINESS_ACCOUNT_ID=<waba id>
   META_WA_APP_SECRET=<app secret from Settings → Basic>
   META_WA_VERIFY_TOKEN=<the same random string>
   ```
6. Restart. The **WhatsApp** button lights up on any lead with an E.164 phone.
   Inbound replies and delivery receipts flow into `Communication` rows.

> **Outbound to cold numbers** requires a pre-approved message template in Meta
> Business Manager. The `POST /api/leads/:id/communications/send` endpoint
> accepts `whatsappTemplateName` + `whatsappLanguageCode` to send those; plain
> text sends only work within the 24-hour customer-service window after the
> lead has replied.

### 5. Calendly

1. Calendly → Integrations → Webhooks (on a paid plan) or use the Calendly API.
2. Create a webhook subscribed to `invitee.created` and `invitee.canceled` pointed at
   `https://<host>/api/public/calendly/webhook`.
3. Copy the signing key into `CALENDLY_WEBHOOK_SIGNING_KEY` in `.env`.

Booked invitees match existing leads by normalized email; unknown emails create a
new lead in `CONSULT_BOOKED` and auto-enroll in the `consult_reminder_v1` sequence.

### 6. Automation engine

- New leads with qualification `QUALIFIED` or `MANUAL_REVIEW` are auto-enrolled in
  `new_lead_qualified_v1` (see [src/lib/automation/sequences.ts](src/lib/automation/sequences.ts)).
- Step 0 fires inline at enrollment (instant inquiry confirmation email + call task).
- Subsequent steps are picked up by the cron every 5 minutes.

Local development — run the cron manually when you want to advance time:

```bash
curl http://localhost:3000/api/cron/process-sequences
```

Or speed-test by setting `CRON_SECRET` in `.env` and tightening step delays in
`sequences.ts` to seconds (`minutesAfterEnroll: 0.1`).

### Lead intake API

Once the database is wired up, inbound leads hit the same endpoint the public form
uses:

```bash
curl -X POST http://localhost:3000/api/public/lead \
  -H 'Content-Type: application/json' \
  -d '{
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@example.com",
    "niche": "STR_OWNER",
    "serviceInterest": "FULL_SERVICE",
    "annualRevenueRange": "OVER_1M",
    "taxesPaidLastYearRange": "OVER_100K",
    "propertyCount": "FIVE_TO_NINE",
    "urgency": "NOW",
    "source": "WEBSITE"
  }'
```

Response includes `score`, `grade`, `qualification`, and whether a lead was newly
created (`created: true`) or merged into an existing record by email/phone.

---

## Full setup (manual, any Postgres)

```bash
# 1. install dependencies
npm install

# 2. configure environment
cp .env.example .env
# then fill in DATABASE_URL + DIRECT_DATABASE_URL at minimum

# 3. generate the Prisma client
npm run db:generate

# 4. create the schema (dev-only migration)
npm run db:migrate -- --name init

# 5. seed sample data
npm run db:seed

# 6. run the app
npm run dev
```

Open <http://localhost:3000>.

### Scripts

| Command              | Purpose                                                    |
| -------------------- | ---------------------------------------------------------- |
| `npm run dev`        | Start Next.js in dev mode                                  |
| `npm run build`      | Production build                                           |
| `npm run start`      | Run the production build                                   |
| `npm run typecheck`  | TypeScript check without emitting                          |
| `npm run lint`       | Next.js lint                                               |
| `npm run db:generate`| Regenerate the Prisma client                               |
| `npm run db:migrate` | Create + apply a dev migration                             |
| `npm run db:deploy`  | Apply pending migrations (prod / CI)                       |
| `npm run db:push`    | Sync schema without a migration (prototyping only)         |
| `npm run db:seed`    | Run `prisma/seed.ts`                                       |
| `npm run db:studio`  | Open Prisma Studio                                         |
| `npm run db:reset`   | Drop, recreate, migrate, and seed (destructive)            |

---

## Data model

See [prisma/schema.prisma](prisma/schema.prisma) for the full source of truth.

Core entities (from Claude.md §6):

- **User** — internal FABBI team members, RBAC via `UserRole` enum.
- **Lead** — master record; captures contact info, full UTM attribution, ICP inputs
  (revenue / taxes / property count / urgency / complexity flags), pipeline state,
  score, grade, and denormalized activity timestamps.
- **LeadSubmission** — append-only raw inbound payload per submission; preserves
  original UTM and form data even after merges.
- **LeadScoreBreakdown** — component-level score snapshot; versioned via `rulesVersion`.
- **PipelineEvent** — append-only timeline for every stage / owner / score change.
- **LeadNote**, **Task** — human activity on the lead.
- **Communication** — every outbound/inbound email / SMS / WhatsApp.
- **MessageTemplate** — admin-editable templates with variable lists.
- **SequenceEnrollment** — automation state per lead per sequence.
- **Proposal** — Ignition-linked proposal lifecycle.
- **ClientHandoff** — sync state to Double / Keeper after a deal is won.
- **LostReason**, **RuleConfig**, **MarketingSpend**, **LeadMerge** — supporting tables.

Scoring weights, grade thresholds, disqualifiers, routing, and stage SLAs all live in
the `RuleConfig` table and are seeded in `prisma/seed.ts`. The scoring engine (to be
built in `src/lib/scoring/`) should read from here, not from hardcoded constants.

### Seed contents

Running `npm run db:seed` gives you:

- 4 users (admin, 2 sales, 1 marketing)
- 7 standard lost reasons
- 5 rule configs (scoring weights, grade thresholds, disqualifiers, SLAs, routing)
- 7 message templates covering inquiry, schedule, reminder, follow-up, breakup, welcome
- 8 representative leads spanning every pipeline stage: high-net-worth STR operators,
  multi-state REIs, W-2 + STR combos, disqualified SMBs, won handoffs, and lost deals
- 3 monthly marketing-spend rows across Google Ads + Meta campaigns
- A sent proposal + follow-up sequence + open call task on `lead-01`
- An accepted proposal + synced Double handoff on `lead-07`

---

## Environment variables

See [.env.example](.env.example). Short guide:

- **Required to run locally:** `DATABASE_URL`, `DIRECT_DATABASE_URL`, one auth provider.
- **Required before automations work:** email provider key, Twilio creds, Calendly token.
- **Required before proposals / handoffs sync automatically:** Ignition + Double/Keeper creds.
  Until those are confirmed, those adapters run in manual / JSON-export mode.

---

## Deploying to Vercel

The fastest way to get public webhook URLs (needed for Calendly + Meta WhatsApp).

```bash
npm i -g vercel        # one-time
vercel login
vercel link            # attach this folder to a new Vercel project
vercel env pull .env   # pull env you've set in the Vercel dashboard (optional)
vercel --prod          # deploy
```

Then in the Vercel project dashboard, add every non-optional variable from
[.env.example](.env.example). Redeploy. The `vercel.json` already configures a
cron job to hit `/api/cron/process-sequences` every 5 minutes — set
`CRON_SECRET` so only Vercel can trigger it.

### Quick production checklist

- [ ] `DATABASE_URL` + `DIRECT_DATABASE_URL` (Neon pooled + direct)
- [ ] `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- [ ] `MS_GRAPH_*` and ran `New-ApplicationAccessPolicy`
- [ ] `META_WA_*` + webhook configured at `/api/public/whatsapp/webhook`
- [ ] `CALENDLY_WEBHOOK_SIGNING_KEY` + webhook at `/api/public/calendly/webhook`
- [ ] `CRON_SECRET`
- [ ] Ran `prisma migrate deploy` against the production database

---

## Deployment notes

Target platform is **Vercel** for the app and a managed Postgres (Supabase, Neon, or
RDS) for the database.

Recommended flow:

1. Push this repo to GitHub and import into Vercel.
2. Add every non-optional variable from `.env.example` in the Vercel project settings.
3. Set the build command to `prisma generate && next build`.
4. Run migrations on deploy via `prisma migrate deploy` (Vercel build step or a one-off
   job — do **not** rely on `db push` in production).
5. Wire Calendly / Twilio / Ignition webhooks to their respective routes under
   `/api/public/*` once those routes exist (Phase 2+).

---

## What's NOT in this scaffold yet

The Claude.md spec defines a four-phase build plan. This repo currently only contains
the pieces needed for Phase 1 kickoff — schema, seed, folder skeleton, and a placeholder
home route. Everything below is planned but unimplemented:

- **Phase 1:** auth wiring, lead intake API, lead list + detail UI, pipeline board,
  scoring service, dashboard, admin rule editor, messaging log UI.
- **Phase 2:** sequence engine, Calendly webhook handler, Twilio SMS/WhatsApp, task
  automation, duplicate detection refinement.
- **Phase 3:** Ignition adapter + proposal lifecycle, Double/Keeper handoff, spend
  attribution dashboards, source-ROI reporting.
- **Phase 4:** AI summarization, lead enrichment, predictive close scoring, partner
  portal.

Each `src/features/*` and `src/lib/integrations/*` folder is intentionally empty so that
Phase 1 work has a clear home to land in.

---

## Conventions

- **Server / client separation:** server-only utilities (Prisma, integrations, secrets)
  live under `src/lib/` and are imported only from Server Components / route handlers.
- **Validation at boundaries:** every public API route and webhook handler must validate
  its input with Zod before touching the database.
- **Audit trail:** any write that moves a lead between stages, changes the owner, or
  updates the score must also create a `PipelineEvent` row in the same transaction.
- **Idempotency:** background jobs and webhook handlers must be idempotent — use
  `externalMessageId` / `externalProposalId` as the idempotency key where available.
- **No hardcoded business rules:** scoring weights, SLAs, disqualifiers, and routing
  live in `RuleConfig` and are edited through the Admin UI.
