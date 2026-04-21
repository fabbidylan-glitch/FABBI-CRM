/**
 * Diagnostic: queries live Neon DB, computes the same KPIs the dashboard
 * computes, and prints them alongside the raw event counts that drive them.
 * Run with: npx tsx prisma/diagnose-kpis.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3_600_000);

  console.log("\n=== RAW DATABASE STATE ===");
  const totalLeads = await prisma.lead.count();
  const totalEvents = await prisma.pipelineEvent.count();
  const totalProposals = await prisma.proposal.count();
  console.log(`  total leads:         ${totalLeads}`);
  console.log(`  total pipeline events: ${totalEvents}`);
  console.log(`  total proposals:     ${totalProposals}`);

  console.log("\n=== LEADS BY STAGE ===");
  const byStage = await prisma.lead.groupBy({
    by: ["pipelineStage"],
    _count: { _all: true },
  });
  for (const row of byStage) {
    console.log(`  ${row.pipelineStage.padEnd(25)} ${row._count._all}`);
  }

  console.log("\n=== PIPELINE EVENTS THIS MONTH (toStage → count) ===");
  const monthEvents = await prisma.pipelineEvent.groupBy({
    by: ["toStage"],
    _count: { _all: true },
    where: {
      eventType: "STAGE_CHANGED",
      createdAt: { gte: startOfMonth },
    },
  });
  if (monthEvents.length === 0) {
    console.log("  (no STAGE_CHANGED events in the current month)");
  } else {
    for (const row of monthEvents) {
      console.log(`  toStage=${(row.toStage ?? "null").padEnd(25)} ${row._count._all}`);
    }
  }

  console.log("\n=== LAST 20 PIPELINE EVENTS (any type) ===");
  const recentEvents = await prisma.pipelineEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      createdAt: true,
      eventType: true,
      fromStage: true,
      toStage: true,
      note: true,
    },
  });
  for (const e of recentEvents) {
    const ts = e.createdAt.toISOString();
    const transition = e.fromStage || e.toStage ? ` ${e.fromStage ?? "-"} → ${e.toStage ?? "-"}` : "";
    console.log(`  ${ts}  ${e.eventType}${transition}  ${(e.note ?? "").slice(0, 60)}`);
  }

  console.log("\n=== COMPUTED DASHBOARD KPIs (what /api/... should return) ===");

  const [leadsThisMonth, qualifiedThisMonth] = await Promise.all([
    prisma.lead.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.lead.count({
      where: { createdAt: { gte: startOfMonth }, qualificationStatus: "QUALIFIED" },
    }),
  ]);

  const [consultsBookedLeads, proposalsSentLeads, wonLeads] = await Promise.all([
    prisma.pipelineEvent.findMany({
      where: { eventType: "STAGE_CHANGED", toStage: "CONSULT_BOOKED", createdAt: { gte: startOfMonth } },
      distinct: ["leadId"],
      select: { leadId: true },
    }),
    prisma.pipelineEvent.findMany({
      where: { eventType: "STAGE_CHANGED", toStage: "PROPOSAL_SENT", createdAt: { gte: startOfMonth } },
      distinct: ["leadId"],
      select: { leadId: true },
    }),
    prisma.pipelineEvent.findMany({
      where: { eventType: "STAGE_CHANGED", toStage: "WON", createdAt: { gte: startOfMonth } },
      distinct: ["leadId"],
      select: { leadId: true },
    }),
  ]);
  const consultsBookedThisMonth = consultsBookedLeads.length;
  const proposalsSent = proposalsSentLeads.length;
  const wonThisMonth = wonLeads.length;

  const wonLeadRecords = wonLeads.length > 0
    ? await prisma.lead.findMany({
        where: { id: { in: wonLeads.map((l) => l.leadId) } },
        select: { estimatedAnnualValue: true },
      })
    : [];
  const wonArrThisMonth = wonLeadRecords.reduce(
    (sum, l) => sum + (l.estimatedAnnualValue ? Number(l.estimatedAnnualValue) : 0),
    0
  );

  const pipelineAgg = await prisma.lead.aggregate({
    where: {
      status: "ACTIVE",
      pipelineStage: { notIn: ["WON", "LOST", "COLD_NURTURE"] },
    },
    _sum: { estimatedAnnualValue: true },
  });
  const pipelineValue = Number(pipelineAgg._sum.estimatedAnnualValue ?? 0);

  const [bookingEvents30d, completedEvents30d] = await Promise.all([
    prisma.pipelineEvent.count({
      where: {
        eventType: "STAGE_CHANGED",
        toStage: "CONSULT_BOOKED",
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.pipelineEvent.count({
      where: {
        eventType: "STAGE_CHANGED",
        toStage: "CONSULT_COMPLETED",
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
  ]);

  const closeRate = proposalsSent > 0 ? wonThisMonth / proposalsSent : 0;

  console.log(`  Leads this month:         ${leadsThisMonth}`);
  console.log(`  Qualified this month:     ${qualifiedThisMonth}`);
  console.log(`  Consults booked (events): ${consultsBookedThisMonth}`);
  console.log(`  Proposals sent (events):  ${proposalsSent}`);
  console.log(`  Won this month (events):  ${wonThisMonth}`);
  console.log(`  Won ARR this month:       $${wonArrThisMonth}`);
  console.log(`  Pipeline value:           $${pipelineValue}`);
  console.log(`  Show rate (30d):          ${(bookingEvents30d > 0 ? completedEvents30d / bookingEvents30d : 0).toFixed(2)}`);
  console.log(`  Close rate:               ${closeRate.toFixed(2)}`);
  console.log(`    (bookingEvents30d=${bookingEvents30d}, completedEvents30d=${completedEvents30d})`);

  console.log("\n=== SANITY: LEADS WITH estimatedAnnualValue SET ===");
  const withValue = await prisma.lead.count({
    where: { estimatedAnnualValue: { not: null } },
  });
  console.log(`  ${withValue} of ${totalLeads} leads have estimatedAnnualValue set`);
  if (withValue === 0) {
    console.log(
      "  ⚠ No leads have $ value set → Pipeline value + Won ARR will always show $0."
    );
  }

  console.log("\n=== NOW ===");
  console.log(`  current time: ${now.toISOString()}`);
  console.log(`  startOfMonth: ${startOfMonth.toISOString()}`);
  console.log(`  thirtyDaysAgo: ${thirtyDaysAgo.toISOString()}`);
}

main()
  .catch((err) => {
    console.error("Diagnostic failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
