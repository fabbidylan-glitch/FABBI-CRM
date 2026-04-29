import "server-only";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import type { UserRole } from "@prisma/client";

/**
 * Roles that may view + mutate STR deals. Tight by design — Phase 2 is internal
 * acquisition underwriting and should stay restricted to people who can act on
 * a deal. SALES can be added later if we open this up to outside reps.
 */
const STR_ALLOWED_ROLES: UserRole[] = ["ADMIN", "MANAGER"];

export type STRActor = {
  userId: string;
  externalId: string;
  role: UserRole;
};

export class STRAuthError extends Error {
  status: 401 | 403;
  constructor(message: string, status: 401 | 403) {
    super(message);
    this.status = status;
    this.name = "STRAuthError";
  }
}

/**
 * Resolves the current Clerk session to an internal User row and confirms the
 * role is allowed. Throws STRAuthError so callers can map to a 401/403 in API
 * routes or `notFound()`/`redirect()` in server components.
 */
export async function requireSTRAccess(): Promise<STRActor> {
  const session = await auth();
  if (!session.userId) {
    throw new STRAuthError("Not signed in", 401);
  }
  const user = await prisma.user.findUnique({
    where: { externalId: session.userId },
    select: { id: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) {
    throw new STRAuthError("No active CRM user for this Clerk identity", 403);
  }
  if (!STR_ALLOWED_ROLES.includes(user.role)) {
    throw new STRAuthError(
      `Role ${user.role} is not allowed to view STR deals`,
      403
    );
  }
  return { userId: user.id, externalId: session.userId, role: user.role };
}

/** Non-throwing variant for server components that need to render a friendly
 * "Access required" state instead of crashing. */
export async function getSTRAccess(): Promise<STRActor | null> {
  try {
    return await requireSTRAccess();
  } catch {
    return null;
  }
}
