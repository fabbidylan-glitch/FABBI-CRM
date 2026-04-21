import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { csvFilename, toCsv } from "@/lib/csv";
import {
  listContacts,
  type ContactSummary,
  type ContactType,
  type ContactsFilter,
} from "@/lib/features/contacts/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTACT_TYPES: readonly ContactType[] = ["CLIENT", "PROSPECT", "NURTURE", "LOST"];

export async function GET(req: NextRequest) {
  if (!config.dbEnabled || !config.authEnabled)
    return NextResponse.json({ error: "Database + auth required." }, { status: 503 });

  const session = await auth();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const rawType = sp.get("type");
  const filter: ContactsFilter = {
    type: rawType && CONTACT_TYPES.includes(rawType as ContactType) ? (rawType as ContactType) : undefined,
    search: sp.get("search") ?? undefined,
  };

  const contacts = await listContacts(filter);

  const headers = [
    "Full name",
    "Email",
    "Phone",
    "Company",
    "Type",
    "Lead count",
    "Latest lead ID",
    "Latest stage",
    "Latest grade",
    "Latest score",
    "Total estimated value",
    "Owner",
    "Last contacted at",
    "Next action at",
    "First seen at",
  ];

  const rows: Array<Array<string | number | Date | null | undefined>> = contacts.map(
    (c: ContactSummary) => [
      c.fullName,
      c.email,
      c.phone,
      c.company,
      c.type,
      c.leadCount,
      c.latestLeadId,
      c.latestLeadStage,
      c.latestLeadGrade,
      c.latestLeadScore,
      c.totalEstimatedValue,
      c.ownerName,
      c.lastContactedAt,
      c.nextActionAt,
      c.firstSeenAt,
    ]
  );

  const csv = toCsv(headers, rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename("fabbi-contacts")}"`,
      "Cache-Control": "no-store",
    },
  });
}
