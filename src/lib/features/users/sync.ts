import "server-only";
import { prisma } from "@/lib/db";

type ClerkLikeUser = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  emailAddresses: Array<{ emailAddress: string; id: string }>;
  primaryEmailAddressId?: string | null;
};

/**
 * Upsert an internal User row keyed by Clerk user id. Called on every
 * authenticated page load (see Shell) and from the Clerk webhook — both
 * paths are idempotent via the unique externalId index.
 *
 * The first synced user is promoted to ADMIN so a brand-new tenant has
 * someone with admin rights without a manual DB edit.
 */
export async function syncClerkUser(user: ClerkLikeUser): Promise<{ id: string }> {
  const primary =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId) ??
    user.emailAddresses[0];
  const email = primary?.emailAddress?.toLowerCase() ?? `${user.id}@no-email.local`;

  const existing = await prisma.user.findUnique({ where: { externalId: user.id } });
  if (existing) {
    const needsUpdate =
      existing.email !== email ||
      existing.firstName !== (user.firstName ?? existing.firstName) ||
      existing.lastName !== (user.lastName ?? existing.lastName);
    if (!needsUpdate) return { id: existing.id };
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        email,
        firstName: user.firstName ?? existing.firstName,
        lastName: user.lastName ?? existing.lastName,
      },
    });
    return { id: updated.id };
  }

  // If a User row already exists by email (e.g. seed data) merge into it by
  // attaching the Clerk id — preserves pre-signup activity attribution.
  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    const linked = await prisma.user.update({
      where: { id: byEmail.id },
      data: {
        externalId: user.id,
        firstName: user.firstName ?? byEmail.firstName,
        lastName: user.lastName ?? byEmail.lastName,
      },
    });
    return { id: linked.id };
  }

  const isFirst = (await prisma.user.count({ where: { externalId: { not: null } } })) === 0;
  const created = await prisma.user.create({
    data: {
      email,
      firstName: user.firstName ?? email.split("@")[0] ?? "User",
      lastName: user.lastName ?? "",
      externalId: user.id,
      role: isFirst ? "ADMIN" : "SALES",
    },
  });
  return { id: created.id };
}

export async function deleteClerkUser(externalId: string) {
  await prisma.user.updateMany({
    where: { externalId },
    data: { isActive: false },
  });
}
