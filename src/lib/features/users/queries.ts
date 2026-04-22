import "server-only";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";

export type UserOption = { id: string; name: string; email: string; role: string };

export async function listActiveUsers(): Promise<UserOption[]> {
  if (!config.dbEnabled) return [];
  const rows = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true, email: true, role: true },
  });
  return rows.map((u) => ({
    id: u.id,
    name: `${u.firstName} ${u.lastName}`.trim() || u.email,
    email: u.email,
    role: u.role,
  }));
}

const DEFAULT_LOST_REASONS = [
  { code: "TOO_EXPENSIVE", label: "Too expensive", sortOrder: 10 },
  { code: "NO_URGENCY", label: "No urgency", sortOrder: 20 },
  { code: "NO_FIT", label: "Not an ICP fit", sortOrder: 30 },
  { code: "WENT_ELSEWHERE", label: "Went elsewhere", sortOrder: 40 },
  { code: "STOPPED_RESPONDING", label: "Stopped responding", sortOrder: 50 },
  { code: "TOO_SMALL", label: "Revenue too small", sortOrder: 60 },
  { code: "NOT_NICHE", label: "Not a niche fit", sortOrder: 70 },
];

export async function listActiveLostReasons() {
  if (!config.dbEnabled) return [];

  const rows = await prisma.lostReason.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, code: true, label: true },
  });

  // Self-heal: if the Neon DB was never seeded (first-time deploys skip the
  // prisma/seed.ts script), materialize the defaults on first access so the
  // LOST-drop modal and Lost-stage lead detail UI have options to pick. The
  // upsert keyed on `code` makes this safe to call repeatedly.
  if (rows.length === 0) {
    await Promise.all(
      DEFAULT_LOST_REASONS.map((r) =>
        prisma.lostReason.upsert({
          where: { code: r.code },
          update: {},
          create: r,
        })
      )
    );
    return prisma.lostReason.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, code: true, label: true },
    });
  }

  return rows;
}
