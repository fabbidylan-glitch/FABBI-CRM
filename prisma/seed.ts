/**
 * FABBI CRM seed data
 *
 * Creates a realistic slice of the FABBI book of business so developers can:
 *   - see the pipeline board populated with leads at every stage
 *   - exercise the scoring engine against representative inputs
 *   - preview source attribution + marketing ROI reporting
 *
 * Safe to run repeatedly: uses upsert by stable unique keys wherever possible.
 */

import {
  AnnualRevenueRange,
  CommunicationChannel,
  CommunicationDirection,
  DeliveryStatus,
  DestinationSystem,
  FitType,
  HandoffStatus,
  LeadGrade,
  LeadSource,
  LeadStatus,
  Niche,
  NoteType,
  PipelineEventType,
  PipelineStage,
  PreferredContactMethod,
  PrismaClient,
  PropertyCountBucket,
  ProposalStatus,
  QualificationStatus,
  ServiceInterest,
  SequenceStatus,
  TaskPriority,
  TaskStatus,
  TaskType,
  TaxesPaidRange,
  UrgencyLevel,
  UserRole,
} from "@prisma/client";

const prisma = new PrismaClient();

// ─── Users ────────────────────────────────────────────────────────────────────

const USERS = [
  {
    email: "dylan@fabbi.co",
    firstName: "Dylan",
    lastName: "Fabbi",
    role: UserRole.ADMIN,
  },
  {
    email: "sales1@fabbi.co",
    firstName: "Morgan",
    lastName: "Hayes",
    role: UserRole.SALES,
  },
  {
    email: "sales2@fabbi.co",
    firstName: "Riley",
    lastName: "Chen",
    role: UserRole.SALES,
  },
  {
    email: "marketing@fabbi.co",
    firstName: "Jordan",
    lastName: "Price",
    role: UserRole.MARKETING,
  },
] as const;

// ─── Lost reasons ─────────────────────────────────────────────────────────────

const LOST_REASONS = [
  { code: "TOO_EXPENSIVE", label: "Too expensive", sortOrder: 10 },
  { code: "NO_URGENCY", label: "No urgency", sortOrder: 20 },
  { code: "NO_FIT", label: "Not an ICP fit", sortOrder: 30 },
  { code: "WENT_ELSEWHERE", label: "Went elsewhere", sortOrder: 40 },
  { code: "STOPPED_RESPONDING", label: "Stopped responding", sortOrder: 50 },
  { code: "TOO_SMALL", label: "Revenue too small", sortOrder: 60 },
  { code: "NOT_NICHE", label: "Not a niche fit", sortOrder: 70 },
];

// ─── Rule configs ─────────────────────────────────────────────────────────────

const RULE_CONFIGS: Array<{ key: string; description: string; valueJson: unknown }> = [
  {
    key: "scoring.weights.v1",
    description: "Default scoring weights (matches Claude.md spec section 7).",
    valueJson: {
      revenue: {
        UNDER_250K: 0,
        FROM_250K_TO_500K: 14,
        FROM_500K_TO_1M: 24,
        OVER_1M: 30,
      },
      taxes: {
        UNDER_10K: 0,
        FROM_10K_TO_25K: 8,
        FROM_25K_TO_50K: 14,
        FROM_50K_TO_100K: 20,
        OVER_100K: 25,
      },
      service: {
        TAX_PREP: 8,
        BOOKKEEPING: 12,
        TAX_STRATEGY: 16,
        BOOKKEEPING_AND_TAX: 16,
        CFO: 18,
        FULL_SERVICE: 20,
        UNSURE: 4,
      },
      propertyCount: {
        NONE: 0,
        ONE: 2,
        TWO_TO_FOUR: 6,
        FIVE_TO_NINE: 10,
        TEN_PLUS: 15,
      },
      urgency: {
        RESEARCHING: 2,
        NEXT_30_DAYS: 7,
        NOW: 10,
      },
      source: {
        REFERRAL: 10,
        PARTNER_REFERRAL: 8,
        ORGANIC_BRANDED: 6,
        GOOGLE_ADS: 5,
        META_ADS: 3,
        CSV_IMPORT: 0,
      },
      complexity: {
        w2Income: 3,
        payroll: 4,
        multipleStates: 3,
        otherBusinessIncome: 3,
      },
      bookedConsultBonus: 5,
    },
  },
  {
    key: "scoring.grades.v1",
    description: "Score thresholds for A/B/C/D grading.",
    valueJson: { A: 80, B: 60, C: 40 },
  },
  {
    key: "qualification.disqualifiers.v1",
    description: "Rules that force DISQUALIFIED regardless of score.",
    valueJson: {
      revenueUnder: "UNDER_250K",
      taxesUnder: "UNDER_10K",
      requireBoth: true,
      requireContact: true,
    },
  },
  {
    key: "pipeline.sla.v1",
    description: "Stage SLAs used for overdue flagging and dashboards.",
    valueJson: {
      NEW_LEAD_A_MINUTES: 5,
      NEW_LEAD_B_HOURS: 1,
      CONTACTED_HOURS: 24,
      QUALIFIED_SAME_DAY: true,
      PROPOSAL_SENT_FOLLOWUP_HOURS: 18,
      WON_HANDOFF_HOURS: 24,
    },
  },
  {
    key: "routing.owners.v1",
    description: "Default owner routing rules. Fallback = round robin on SALES.",
    valueJson: {
      byGrade: { A: "sales1@fabbi.co", B: "sales2@fabbi.co" },
      bySource: { PARTNER_REFERRAL: "sales1@fabbi.co" },
    },
  },
];

// ─── Message templates ────────────────────────────────────────────────────────

const MESSAGE_TEMPLATES = [
  {
    key: "inquiry.confirmation.email",
    name: "Inquiry received — confirmation",
    channel: CommunicationChannel.EMAIL,
    category: "inquiry_confirmation",
    subject: "Thanks for reaching out to FABBI, {{first_name}}",
    bodyText:
      "Hi {{first_name}},\n\nThanks for contacting FABBI. We specialize in tax strategy, " +
      "bookkeeping, and full-service accounting for short-term rental owners and real estate investors. " +
      "We received your inquiry about {{service_interest}} and will be in touch shortly.\n\n— {{owner_name}}, FABBI",
    variables: ["first_name", "service_interest", "owner_name"],
  },
  {
    key: "qualified.schedule.email",
    name: "Qualified — schedule consult",
    channel: CommunicationChannel.EMAIL,
    category: "schedule_consult",
    subject: "Let's find a time, {{first_name}}",
    bodyText:
      "Hi {{first_name}},\n\nBased on what you shared, I think we can help. " +
      "Grab a time that works here: {{booking_link}}.\n\nTalk soon,\n{{owner_name}}",
    variables: ["first_name", "booking_link", "owner_name"],
  },
  {
    key: "qualified.schedule.sms",
    name: "Qualified — schedule consult (SMS)",
    channel: CommunicationChannel.SMS,
    category: "schedule_consult",
    subject: null,
    bodyText:
      "Hi {{first_name}}, {{owner_name}} from FABBI. Book a consult here: {{booking_link}} — " +
      "reply STOP to opt out.",
    variables: ["first_name", "owner_name", "booking_link"],
  },
  {
    key: "consult.reminder.24h.email",
    name: "Consult reminder — 24h",
    channel: CommunicationChannel.EMAIL,
    category: "consult_reminder",
    subject: "Reminder: our call tomorrow",
    bodyText: "Hi {{first_name}}, looking forward to our conversation tomorrow. — {{owner_name}}",
    variables: ["first_name", "owner_name"],
  },
  {
    key: "proposal.followup.d1.email",
    name: "Proposal follow-up — day 1",
    channel: CommunicationChannel.EMAIL,
    category: "proposal_followup",
    subject: "Following up on your proposal",
    bodyText:
      "Hi {{first_name}}, wanted to make sure the proposal I sent arrived OK: {{proposal_link}}. " +
      "Happy to jump on a quick call to walk through it. — {{owner_name}}",
    variables: ["first_name", "proposal_link", "owner_name"],
  },
  {
    key: "proposal.breakup.d5.email",
    name: "Proposal breakup — final",
    channel: CommunicationChannel.EMAIL,
    category: "breakup",
    subject: "Closing the loop",
    bodyText:
      "Hi {{first_name}}, I haven't heard back so I'll close out your file for now. " +
      "If the timing changes, just reply and we'll pick it back up. — {{owner_name}}",
    variables: ["first_name", "owner_name"],
  },
  {
    key: "won.welcome.email",
    name: "Won — welcome + onboarding",
    channel: CommunicationChannel.EMAIL,
    category: "welcome_onboarding",
    subject: "Welcome to FABBI, {{first_name}}",
    bodyText:
      "Welcome aboard, {{first_name}}. Your onboarding checklist is attached. " +
      "Your dedicated contact at {{firm_name}} is {{owner_name}}.",
    variables: ["first_name", "owner_name", "firm_name"],
  },
  {
    key: "consult.no_show.rebook.email",
    name: "Consult no-show — rebook nudge",
    channel: CommunicationChannel.EMAIL,
    category: "no_show_rebook",
    subject: "Sorry we missed you, {{first_name}}",
    bodyText:
      "Hi {{first_name}},\n\nLooks like our call today didn't happen on your end — totally fine, life happens. " +
      "Grab a new time whenever works for you: {{booking_link}}\n\nIf it's easier, reply here with a few windows and I'll send an invite.\n\n— {{owner_name}}",
    variables: ["first_name", "booking_link", "owner_name"],
  },
  {
    key: "consult.no_show.rebook.sms",
    name: "Consult no-show — rebook (SMS)",
    channel: CommunicationChannel.SMS,
    category: "no_show_rebook",
    subject: null,
    bodyText:
      "Hi {{first_name}}, {{owner_name}} from FABBI. Missed you on today's call — rebook a time here: {{booking_link}}. Reply STOP to opt out.",
    variables: ["first_name", "owner_name", "booking_link"],
  },
];

// ─── Marketing spend ──────────────────────────────────────────────────────────

const MARKETING_SPEND = [
  {
    date: new Date("2026-03-01"),
    source: LeadSource.GOOGLE_ADS,
    campaignName: "STR-Owners-Search",
    spendAmount: 4200,
    clicks: 612,
    impressions: 18400,
    leadsCount: 21,
  },
  {
    date: new Date("2026-03-01"),
    source: LeadSource.META_ADS,
    campaignName: "REI-Tax-Strategy",
    spendAmount: 2800,
    clicks: 930,
    impressions: 62000,
    leadsCount: 14,
  },
  {
    date: new Date("2026-04-01"),
    source: LeadSource.GOOGLE_ADS,
    campaignName: "STR-Owners-Search",
    spendAmount: 5100,
    clicks: 744,
    impressions: 21200,
    leadsCount: 28,
  },
];

// ─── Seed leads ───────────────────────────────────────────────────────────────

type SeedLead = {
  key: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneE164: string;
  source: LeadSource;
  campaignName?: string;
  niche: Niche;
  fitType: FitType;
  serviceInterest: ServiceInterest;
  annualRevenueRange: AnnualRevenueRange;
  taxesPaidLastYearRange: TaxesPaidRange;
  propertyCount: PropertyCountBucket;
  urgency: UrgencyLevel;
  w2IncomeFlag?: boolean;
  payrollFlag?: boolean;
  otherBusinessIncomeFlag?: boolean;
  statesOfOperation?: string[];
  pipelineStage: PipelineStage;
  qualificationStatus: QualificationStatus;
  leadScore: number;
  leadGrade: LeadGrade;
  estimatedAnnualValue?: number;
  ownerEmail?: string;
  painPoint?: string;
};

const LEADS: SeedLead[] = [
  {
    key: "lead-01",
    firstName: "Alex",
    lastName: "Morgan",
    email: "alex.morgan@example.com",
    phoneE164: "+15125550101",
    source: LeadSource.REFERRAL,
    niche: Niche.HIGH_INCOME_STR_STRATEGY,
    fitType: FitType.ICP_PREMIUM,
    serviceInterest: ServiceInterest.FULL_SERVICE,
    annualRevenueRange: AnnualRevenueRange.OVER_1M,
    taxesPaidLastYearRange: TaxesPaidRange.OVER_100K,
    propertyCount: PropertyCountBucket.FIVE_TO_NINE,
    urgency: UrgencyLevel.NOW,
    w2IncomeFlag: true,
    payrollFlag: true,
    otherBusinessIncomeFlag: true,
    statesOfOperation: ["TX", "FL", "CO"],
    pipelineStage: PipelineStage.PROPOSAL_SENT,
    qualificationStatus: QualificationStatus.QUALIFIED,
    leadScore: 95,
    leadGrade: LeadGrade.A,
    estimatedAnnualValue: 48000,
    ownerEmail: "sales1@fabbi.co",
    painPoint: "Current CPA doesn't understand STR cost segregation.",
  },
  {
    key: "lead-02",
    firstName: "Priya",
    lastName: "Shah",
    email: "priya.shah@example.com",
    phoneE164: "+14805550102",
    source: LeadSource.GOOGLE_ADS,
    campaignName: "STR-Owners-Search",
    niche: Niche.STR_OWNER,
    fitType: FitType.ICP,
    serviceInterest: ServiceInterest.BOOKKEEPING_AND_TAX,
    annualRevenueRange: AnnualRevenueRange.FROM_500K_TO_1M,
    taxesPaidLastYearRange: TaxesPaidRange.FROM_50K_TO_100K,
    propertyCount: PropertyCountBucket.TWO_TO_FOUR,
    urgency: UrgencyLevel.NEXT_30_DAYS,
    w2IncomeFlag: true,
    statesOfOperation: ["AZ", "CA"],
    pipelineStage: PipelineStage.CONSULT_BOOKED,
    qualificationStatus: QualificationStatus.QUALIFIED,
    leadScore: 82,
    leadGrade: LeadGrade.A,
    estimatedAnnualValue: 22000,
    ownerEmail: "sales1@fabbi.co",
    painPoint: "Wants to stop using Turbotax now that STR portfolio is scaling.",
  },
  {
    key: "lead-03",
    firstName: "Jonathan",
    lastName: "Okafor",
    email: "jonathan.okafor@example.com",
    phoneE164: "+17185550103",
    source: LeadSource.META_ADS,
    campaignName: "REI-Tax-Strategy",
    niche: Niche.REAL_ESTATE_INVESTOR,
    fitType: FitType.ICP,
    serviceInterest: ServiceInterest.TAX_STRATEGY,
    annualRevenueRange: AnnualRevenueRange.FROM_500K_TO_1M,
    taxesPaidLastYearRange: TaxesPaidRange.FROM_25K_TO_50K,
    propertyCount: PropertyCountBucket.TEN_PLUS,
    urgency: UrgencyLevel.NOW,
    statesOfOperation: ["NY", "NJ", "PA"],
    pipelineStage: PipelineStage.QUALIFIED,
    qualificationStatus: QualificationStatus.QUALIFIED,
    leadScore: 78,
    leadGrade: LeadGrade.B,
    estimatedAnnualValue: 18000,
    ownerEmail: "sales2@fabbi.co",
    painPoint: "Large multi-state REI portfolio needs entity restructuring.",
  },
  {
    key: "lead-04",
    firstName: "Maya",
    lastName: "Rodriguez",
    email: "maya.rodriguez@example.com",
    phoneE164: "+13055550104",
    source: LeadSource.LANDING_PAGE,
    campaignName: "real-estate-investors",
    niche: Niche.REAL_ESTATE_INVESTOR,
    fitType: FitType.ICP,
    serviceInterest: ServiceInterest.CFO,
    annualRevenueRange: AnnualRevenueRange.OVER_1M,
    taxesPaidLastYearRange: TaxesPaidRange.FROM_50K_TO_100K,
    propertyCount: PropertyCountBucket.TEN_PLUS,
    urgency: UrgencyLevel.NEXT_30_DAYS,
    payrollFlag: true,
    otherBusinessIncomeFlag: true,
    statesOfOperation: ["FL", "GA"],
    pipelineStage: PipelineStage.NEW_LEAD,
    qualificationStatus: QualificationStatus.MANUAL_REVIEW,
    leadScore: 73,
    leadGrade: LeadGrade.B,
    estimatedAnnualValue: 36000,
    painPoint: "Scaling rapidly, needs CFO-level financial planning.",
  },
  {
    key: "lead-05",
    firstName: "Chris",
    lastName: "Nguyen",
    email: "chris.nguyen@example.com",
    phoneE164: "+12065550105",
    source: LeadSource.GOOGLE_ADS,
    campaignName: "STR-Owners-Search",
    niche: Niche.AIRBNB_VRBO_OPERATOR,
    fitType: FitType.ICP,
    serviceInterest: ServiceInterest.TAX_STRATEGY,
    annualRevenueRange: AnnualRevenueRange.FROM_250K_TO_500K,
    taxesPaidLastYearRange: TaxesPaidRange.FROM_25K_TO_50K,
    propertyCount: PropertyCountBucket.TWO_TO_FOUR,
    urgency: UrgencyLevel.NEXT_30_DAYS,
    w2IncomeFlag: true,
    statesOfOperation: ["WA"],
    pipelineStage: PipelineStage.CONTACTED,
    qualificationStatus: QualificationStatus.QUALIFIED,
    leadScore: 67,
    leadGrade: LeadGrade.B,
    estimatedAnnualValue: 14000,
    ownerEmail: "sales2@fabbi.co",
    painPoint: "W-2 + STR combo, wants to use STR loophole.",
  },
  {
    key: "lead-06",
    firstName: "Erin",
    lastName: "Walsh",
    email: "erin.walsh@example.com",
    phoneE164: "+16175550106",
    source: LeadSource.WEBSITE,
    niche: Niche.GENERAL_SMB,
    fitType: FitType.STRETCH,
    serviceInterest: ServiceInterest.BOOKKEEPING,
    annualRevenueRange: AnnualRevenueRange.UNDER_250K,
    taxesPaidLastYearRange: TaxesPaidRange.UNDER_10K,
    propertyCount: PropertyCountBucket.NONE,
    urgency: UrgencyLevel.RESEARCHING,
    pipelineStage: PipelineStage.COLD_NURTURE,
    qualificationStatus: QualificationStatus.DISQUALIFIED,
    leadScore: 18,
    leadGrade: LeadGrade.D,
    painPoint: "Solo consultant — revenue below ICP floor.",
  },
  {
    key: "lead-07",
    firstName: "Daniel",
    lastName: "Kim",
    email: "daniel.kim@example.com",
    phoneE164: "+14155550107",
    source: LeadSource.PARTNER_REFERRAL,
    niche: Niche.HIGH_INCOME_STR_STRATEGY,
    fitType: FitType.ICP_PREMIUM,
    serviceInterest: ServiceInterest.FULL_SERVICE,
    annualRevenueRange: AnnualRevenueRange.OVER_1M,
    taxesPaidLastYearRange: TaxesPaidRange.OVER_100K,
    propertyCount: PropertyCountBucket.TEN_PLUS,
    urgency: UrgencyLevel.NOW,
    w2IncomeFlag: true,
    otherBusinessIncomeFlag: true,
    statesOfOperation: ["CA", "NV", "HI"],
    pipelineStage: PipelineStage.WON,
    qualificationStatus: QualificationStatus.QUALIFIED,
    leadScore: 98,
    leadGrade: LeadGrade.A,
    estimatedAnnualValue: 60000,
    ownerEmail: "sales1@fabbi.co",
    painPoint: "Exited tech role, full-time REI investor with W-2 residual.",
  },
  {
    key: "lead-08",
    firstName: "Sophia",
    lastName: "Patel",
    email: "sophia.patel@example.com",
    phoneE164: "+16465550108",
    source: LeadSource.ORGANIC_BRANDED,
    niche: Niche.STR_OWNER,
    fitType: FitType.ICP,
    serviceInterest: ServiceInterest.BOOKKEEPING_AND_TAX,
    annualRevenueRange: AnnualRevenueRange.FROM_250K_TO_500K,
    taxesPaidLastYearRange: TaxesPaidRange.FROM_10K_TO_25K,
    propertyCount: PropertyCountBucket.TWO_TO_FOUR,
    urgency: UrgencyLevel.NEXT_30_DAYS,
    statesOfOperation: ["NC", "SC"],
    pipelineStage: PipelineStage.LOST,
    qualificationStatus: QualificationStatus.NURTURE_ONLY,
    leadScore: 52,
    leadGrade: LeadGrade.C,
    painPoint: "Went with a cheaper provider after second call.",
  },
];

// ─── Seed runner ──────────────────────────────────────────────────────────────

async function main() {
  console.log("→ seeding users");
  const users = new Map<string, { id: string; firstName: string; lastName: string }>();
  for (const u of USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { firstName: u.firstName, lastName: u.lastName, role: u.role },
      create: { email: u.email, firstName: u.firstName, lastName: u.lastName, role: u.role },
    });
    users.set(user.email, { id: user.id, firstName: user.firstName, lastName: user.lastName });
  }

  console.log("→ seeding lost reasons");
  for (const r of LOST_REASONS) {
    await prisma.lostReason.upsert({
      where: { code: r.code },
      update: { label: r.label, sortOrder: r.sortOrder },
      create: r,
    });
  }

  console.log("→ seeding rule configs");
  for (const r of RULE_CONFIGS) {
    await prisma.ruleConfig.upsert({
      where: { key: r.key },
      update: { valueJson: r.valueJson as never, description: r.description },
      create: { key: r.key, valueJson: r.valueJson as never, description: r.description },
    });
  }

  console.log("→ seeding message templates");
  for (const t of MESSAGE_TEMPLATES) {
    await prisma.messageTemplate.upsert({
      where: { key: t.key },
      update: {
        name: t.name,
        channel: t.channel,
        category: t.category,
        subject: t.subject ?? null,
        bodyText: t.bodyText,
        variables: t.variables,
      },
      create: {
        key: t.key,
        name: t.name,
        channel: t.channel,
        category: t.category,
        subject: t.subject ?? null,
        bodyText: t.bodyText,
        variables: t.variables,
      },
    });
  }

  console.log("→ seeding marketing spend");
  for (const s of MARKETING_SPEND) {
    await prisma.marketingSpend.upsert({
      where: {
        date_source_campaignName: {
          date: s.date,
          source: s.source,
          campaignName: s.campaignName ?? null,
        },
      },
      update: {
        spendAmount: s.spendAmount,
        clicks: s.clicks,
        impressions: s.impressions,
        leadsCount: s.leadsCount,
      },
      create: s,
    });
  }

  console.log("→ seeding leads + timeline");
  for (const seed of LEADS) {
    const ownerId = seed.ownerEmail ? users.get(seed.ownerEmail)?.id : undefined;
    const emailNormalized = seed.email.toLowerCase();

    const lead = await prisma.lead.upsert({
      where: { id: seed.key },
      update: {
        pipelineStage: seed.pipelineStage,
        qualificationStatus: seed.qualificationStatus,
        leadScore: seed.leadScore,
        leadGrade: seed.leadGrade,
        ownerUserId: ownerId ?? null,
      },
      create: {
        id: seed.key,
        firstName: seed.firstName,
        lastName: seed.lastName,
        fullName: `${seed.firstName} ${seed.lastName}`,
        email: seed.email,
        emailNormalized,
        phone: seed.phoneE164,
        phoneE164: seed.phoneE164,
        preferredContactMethod: PreferredContactMethod.EMAIL,
        source: seed.source,
        campaignName: seed.campaignName ?? null,
        utmSource: seed.source.toLowerCase(),
        utmCampaign: seed.campaignName ?? null,
        niche: seed.niche,
        fitType: seed.fitType,
        serviceInterest: seed.serviceInterest,
        annualRevenueRange: seed.annualRevenueRange,
        taxesPaidLastYearRange: seed.taxesPaidLastYearRange,
        propertyCount: seed.propertyCount,
        urgency: seed.urgency,
        w2IncomeFlag: seed.w2IncomeFlag ?? false,
        payrollFlag: seed.payrollFlag ?? false,
        otherBusinessIncomeFlag: seed.otherBusinessIncomeFlag ?? false,
        statesOfOperation: seed.statesOfOperation ?? [],
        painPoint: seed.painPoint ?? null,
        status: LeadStatus.ACTIVE,
        pipelineStage: seed.pipelineStage,
        qualificationStatus: seed.qualificationStatus,
        leadScore: seed.leadScore,
        leadGrade: seed.leadGrade,
        estimatedAnnualValue: seed.estimatedAnnualValue ?? null,
        ownerUserId: ownerId ?? null,
      },
    });

    // Raw submission snapshot
    await prisma.leadSubmission.create({
      data: {
        leadId: lead.id,
        sourceType: seed.source,
        payloadJson: {
          firstName: seed.firstName,
          lastName: seed.lastName,
          email: seed.email,
          phone: seed.phoneE164,
          serviceInterest: seed.serviceInterest,
          niche: seed.niche,
          propertyCount: seed.propertyCount,
          urgency: seed.urgency,
        },
        landingPageUrl:
          seed.source === LeadSource.LANDING_PAGE
            ? "https://fabbi.co/lp/real-estate-investors"
            : "https://fabbi.co/",
      },
    });

    // Score breakdown (rough attribution of the total across buckets)
    await prisma.leadScoreBreakdown.create({
      data: {
        leadId: lead.id,
        revenueScore: Math.round(seed.leadScore * 0.3),
        taxScore: Math.round(seed.leadScore * 0.25),
        serviceScore: Math.round(seed.leadScore * 0.15),
        fitScore: Math.round(seed.leadScore * 0.1),
        urgencyScore: Math.round(seed.leadScore * 0.05),
        sourceScore: Math.round(seed.leadScore * 0.05),
        complexityScore: Math.round(seed.leadScore * 0.05),
        bookedConsultScore:
          seed.pipelineStage === PipelineStage.CONSULT_BOOKED ||
          seed.pipelineStage === PipelineStage.CONSULT_COMPLETED ||
          seed.pipelineStage === PipelineStage.PROPOSAL_SENT ||
          seed.pipelineStage === PipelineStage.WON
            ? 5
            : 0,
        totalScore: seed.leadScore,
        rulesVersion: "scoring.weights.v1",
      },
    });

    // Lead created event
    await prisma.pipelineEvent.create({
      data: {
        leadId: lead.id,
        eventType: PipelineEventType.LEAD_CREATED,
        toStage: PipelineStage.NEW_LEAD,
        note: `Lead created via ${seed.source}.`,
      },
    });

    if (seed.pipelineStage !== PipelineStage.NEW_LEAD) {
      await prisma.pipelineEvent.create({
        data: {
          leadId: lead.id,
          actorUserId: ownerId ?? null,
          eventType: PipelineEventType.STAGE_CHANGED,
          fromStage: PipelineStage.NEW_LEAD,
          toStage: seed.pipelineStage,
          note: `Advanced to ${seed.pipelineStage}.`,
        },
      });
    }

    // Owner note for qualified+ leads
    if (ownerId && seed.painPoint) {
      await prisma.leadNote.create({
        data: {
          leadId: lead.id,
          authorUserId: ownerId,
          body: seed.painPoint,
          noteType: NoteType.DISCOVERY,
        },
      });
    }
  }

  // A proposal on lead-01 (PROPOSAL_SENT)
  console.log("→ seeding proposal + followup comms");
  const proposalLead = await prisma.lead.findUnique({ where: { id: "lead-01" } });
  if (proposalLead) {
    const existing = await prisma.proposal.findFirst({ where: { leadId: proposalLead.id } });
    const proposal =
      existing ??
      (await prisma.proposal.create({
        data: {
          leadId: proposalLead.id,
          externalProposalId: "ign_demo_12345",
          proposalStatus: ProposalStatus.SENT,
          servicePackage: "Full-Service (STR Premium)",
          monthlyValue: 4000,
          annualValue: 48000,
          sentAt: new Date("2026-04-15"),
          viewedAt: new Date("2026-04-15T18:04:00Z"),
        },
      }));

    await prisma.communication.create({
      data: {
        leadId: proposalLead.id,
        channel: CommunicationChannel.EMAIL,
        direction: CommunicationDirection.OUTBOUND,
        templateKey: "proposal.followup.d1.email",
        subject: "Following up on your proposal",
        bodyText: "Hi Alex, wanted to make sure the proposal arrived OK…",
        deliveryStatus: DeliveryStatus.DELIVERED,
        sentAt: new Date("2026-04-16T13:00:00Z"),
        deliveredAt: new Date("2026-04-16T13:00:05Z"),
      },
    });

    await prisma.sequenceEnrollment.upsert({
      where: { leadId_sequenceKey: { leadId: proposalLead.id, sequenceKey: "proposal_followup_v1" } },
      update: { status: SequenceStatus.ACTIVE, currentStepIndex: 2 },
      create: {
        leadId: proposalLead.id,
        sequenceKey: "proposal_followup_v1",
        status: SequenceStatus.ACTIVE,
        currentStepIndex: 2,
        nextStepAt: new Date("2026-04-21T13:00:00Z"),
      },
    });

    await prisma.task.create({
      data: {
        leadId: proposalLead.id,
        assignedUserId: proposalLead.ownerUserId ?? null,
        taskType: TaskType.CALL,
        title: "Call Alex re: proposal",
        description: "Walk through Full-Service package, answer pricing questions.",
        dueAt: new Date("2026-04-22T16:00:00Z"),
        status: TaskStatus.OPEN,
        priority: TaskPriority.HIGH,
      },
    });

    // Won handoff on lead-07
    const wonLead = await prisma.lead.findUnique({ where: { id: "lead-07" } });
    if (wonLead) {
      await prisma.proposal.upsert({
        where: { externalProposalId: "ign_demo_99999" },
        update: {
          proposalStatus: ProposalStatus.ACCEPTED,
          acceptedAt: new Date("2026-04-10"),
        },
        create: {
          leadId: wonLead.id,
          externalProposalId: "ign_demo_99999",
          proposalStatus: ProposalStatus.ACCEPTED,
          servicePackage: "Full-Service Premium",
          monthlyValue: 5000,
          annualValue: 60000,
          sentAt: new Date("2026-04-05"),
          acceptedAt: new Date("2026-04-10"),
        },
      });

      const existingHandoff = await prisma.clientHandoff.findFirst({
        where: { leadId: wonLead.id, destinationSystem: DestinationSystem.DOUBLE },
      });
      if (!existingHandoff) {
        await prisma.clientHandoff.create({
          data: {
            leadId: wonLead.id,
            destinationSystem: DestinationSystem.DOUBLE,
            handoffStatus: HandoffStatus.SYNCED,
            syncedAt: new Date("2026-04-11"),
            payloadJson: {
              clientName: "Daniel Kim",
              package: "Full-Service Premium",
              annualValue: 60000,
              onboardingOwner: "sales1@fabbi.co",
            },
          },
        });
      }
    }

    // suppress unused-var lint: proposal is referenced above for clarity
    void proposal;
  }

  console.log("✓ seed complete");
}

main()
  .catch((err) => {
    console.error("seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
