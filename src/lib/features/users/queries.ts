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

export async function listActiveLostReasons() {
  if (!config.dbEnabled) return [];
  return prisma.lostReason.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, code: true, label: true },
  });
}
