/**
 * Production-safe template sync.
 *
 * Upserts every row in MESSAGE_TEMPLATES (from ./message-templates.ts)
 * and nothing else. Does NOT touch Leads, Users, RuleConfigs, or any of
 * the other tables that prisma/seed.ts also manages — so this is safe
 * to run against the production database on every deploy.
 *
 * Wired into `npm run build` in package.json so Vercel applies template
 * changes automatically. Also exposed as `npm run db:sync-templates` for
 * manual runs.
 *
 * Exits 0 on success, non-zero on any Prisma / DB error. A failure here
 * should block the deploy — it means the CRM would otherwise ship with
 * stale email copy.
 */

import { PrismaClient } from "@prisma/client";
import { syncMessageTemplates } from "./message-templates";

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log("→ syncing MessageTemplate rows");
    const result = await syncMessageTemplates(prisma);
    console.log(
      `  ✓ ${result.total} templates (${result.created} created, ${result.updated} updated)`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("template sync failed:", err);
  process.exit(1);
});
