import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { intakeLead } from "@/lib/features/leads/intake";
import { leadIntakeSchema } from "@/lib/validators/lead-intake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rowSchema = z.object({
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  email: z.string().trim().toLowerCase().email().max(160),
  phone: z.string().trim().optional(),
  companyName: z.string().trim().optional(),
  source: z.string().trim().optional(),
  niche: z.string().trim().optional(),
  serviceInterest: z.string().trim().optional(),
  annualRevenueRange: z.string().trim().optional(),
  taxesPaidLastYearRange: z.string().trim().optional(),
  propertyCount: z.string().trim().optional(),
  urgency: z.string().trim().optional(),
  painPoint: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

const bodySchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(2000),
  defaults: z
    .object({
      source: z.string().trim().optional(),
      niche: z.string().trim().optional(),
      serviceInterest: z.string().trim().optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  if (!config.dbEnabled || !config.authEnabled)
    return NextResponse.json({ error: "Database + auth required." }, { status: 503 });

  const session = await auth();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );

  const defaults = parsed.data.defaults ?? {};
  const outcomes: Array<
    | { index: number; status: "created" | "merged"; leadId: string; score: number; grade: string }
    | { index: number; status: "error"; error: string }
  > = [];

  for (let i = 0; i < parsed.data.rows.length; i++) {
    const raw = parsed.data.rows[i] as Record<string, unknown>;
    const row = rowSchema.safeParse(raw);
    if (!row.success) {
      outcomes.push({
        index: i,
        status: "error",
        error: row.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; "),
      });
      continue;
    }

    const input = leadIntakeSchema.safeParse({
      firstName: row.data.firstName ?? row.data.email.split("@")[0] ?? "Imported",
      lastName: row.data.lastName ?? "Lead",
      email: row.data.email,
      phone: row.data.phone ?? "",
      companyName: row.data.companyName ?? "",
      source: (row.data.source ?? defaults.source ?? "CSV_IMPORT").toUpperCase(),
      niche: (row.data.niche ?? defaults.niche ?? "UNKNOWN").toUpperCase(),
      serviceInterest: (row.data.serviceInterest ?? defaults.serviceInterest ?? "UNSURE").toUpperCase(),
      annualRevenueRange: (row.data.annualRevenueRange ?? "UNKNOWN").toUpperCase(),
      taxesPaidLastYearRange: (row.data.taxesPaidLastYearRange ?? "UNKNOWN").toUpperCase(),
      propertyCount: (row.data.propertyCount ?? "UNKNOWN").toUpperCase(),
      urgency: (row.data.urgency ?? "UNKNOWN").toUpperCase(),
      painPoint: row.data.painPoint,
      notes: row.data.notes,
    });

    if (!input.success) {
      outcomes.push({
        index: i,
        status: "error",
        error: input.error.issues
          .map((x) => `${x.path.join(".")}: ${x.message}`)
          .slice(0, 3)
          .join("; "),
      });
      continue;
    }

    try {
      const result = await intakeLead(input.data);
      outcomes.push({
        index: i,
        status: result.created ? "created" : "merged",
        leadId: result.leadId,
        score: result.score,
        grade: result.grade,
      });
    } catch (err) {
      outcomes.push({
        index: i,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const summary = {
    total: outcomes.length,
    created: outcomes.filter((o) => o.status === "created").length,
    merged: outcomes.filter((o) => o.status === "merged").length,
    errors: outcomes.filter((o) => o.status === "error").length,
  };
  return NextResponse.json({ ok: true, summary, outcomes });
}
