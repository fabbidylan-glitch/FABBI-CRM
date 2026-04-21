import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Minimal search endpoint powering the Cmd/Ctrl+K palette. Returns up to 20
 * leads whose name / email / company contains the query (case-insensitive).
 * Fast enough at current scale; at ~10k leads add pg_trgm + a GIN index.
 */
export async function GET(req: NextRequest) {
  if (!config.dbEnabled || !config.authEnabled) {
    return NextResponse.json({ results: [] });
  }
  const session = await auth();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json({ results: [] });

  const leads = await prisma.lead.findMany({
    where: {
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { fullName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { companyName: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: [{ leadScore: "desc" }, { createdAt: "desc" }],
    take: 20,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      fullName: true,
      email: true,
      companyName: true,
      pipelineStage: true,
      leadGrade: true,
    },
  });

  return NextResponse.json({
    results: leads.map((l) => ({
      id: l.id,
      name:
        l.fullName ||
        `${l.firstName ?? ""} ${l.lastName ?? ""}`.trim() ||
        l.email ||
        "Unknown",
      email: l.email ?? "",
      company: l.companyName ?? "",
      stage: l.pipelineStage,
      grade: l.leadGrade ?? "D",
    })),
  });
}
