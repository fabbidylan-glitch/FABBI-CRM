import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { csvFilename, toCsv } from "@/lib/csv";
import { listLeads, type LeadsFilter, type LeadsSortKey } from "@/lib/features/leads/queries";
import type { Lead, Stage } from "@/lib/preview/fixtures";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SORT_COLUMNS: readonly LeadsSortKey[] = [
  "name",
  "niche",
  "service",
  "source",
  "score",
  "stage",
  "arr",
  "created",
  "owner",
  "nextAction",
];

export async function GET(req: NextRequest) {
  if (!config.dbEnabled || !config.authEnabled)
    return NextResponse.json({ error: "Database + auth required." }, { status: 503 });

  const session = await auth();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const rawSort = sp.get("sort") ?? undefined;
  const sort = rawSort && SORT_COLUMNS.includes(rawSort as LeadsSortKey)
    ? (rawSort as LeadsSortKey)
    : undefined;
  const dir = sp.get("dir") === "asc" ? "asc" : sp.get("dir") === "desc" ? "desc" : undefined;

  const filter: LeadsFilter = {
    search: sp.get("search") ?? undefined,
    stage: (sp.get("stage") as Stage | null) ?? undefined,
    source: sp.get("source") ?? undefined,
    grade: (sp.get("grade") as LeadsFilter["grade"]) ?? undefined,
    qualification: (sp.get("qualification") as LeadsFilter["qualification"]) ?? undefined,
    niche: sp.get("niche") ?? undefined,
    serviceInterest: sp.get("serviceInterest") ?? undefined,
    urgency: sp.get("urgency") ?? undefined,
    sort,
    dir,
  };

  const leads = await listLeads(filter);

  const headers = [
    "Lead ID",
    "First name",
    "Last name",
    "Email",
    "Phone",
    "Company",
    "Niche",
    "Source",
    "Campaign",
    "Service interest",
    "Annual revenue",
    "Taxes paid",
    "Properties",
    "Urgency",
    "States",
    "Stage",
    "Qualification",
    "Score",
    "Grade",
    "Estimated annual value",
    "Owner",
    "Created at",
    "Last contacted at",
    "Next action at",
    "Next action",
  ];

  const rows: Array<Array<string | number | Date | null | undefined>> = leads.map((l: Lead) => [
    l.id,
    l.firstName,
    l.lastName,
    l.email,
    l.phone,
    l.companyName,
    l.niche,
    l.source,
    l.campaignName,
    l.serviceInterest,
    l.annualRevenueRange,
    l.taxesPaidLastYearRange,
    l.propertyCount,
    l.urgency,
    l.states.join("|"),
    l.stage,
    l.qualification,
    l.score,
    l.grade,
    l.estimatedAnnualValue ?? null,
    l.ownerName,
    l.createdAt,
    l.lastContactedAt,
    l.nextActionAt,
    l.nextActionTitle,
  ]);

  const csv = toCsv(headers, rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename("fabbi-leads")}"`,
      "Cache-Control": "no-store",
    },
  });
}
