import "server-only";
import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

/**
 * Lost-reason enforcement: any Lead write that sets `pipelineStage = LOST`
 * must also set `lostReasonId` (or already have one on the row). Without this,
 * a scripted caller or future codepath could skip the UI's modal check and
 * leave us with Lost leads that have no attributable reason — which wrecks
 * the "Lost reasons" analytics the Dashboard needs.
 */
function createPrisma(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });
  return client.$extends({
    query: {
      lead: {
        async update({ args, query }) {
          await enforceLostReason(client, args.where, args.data);
          return query(args);
        },
        async updateMany({ args, query }) {
          // updateMany with stage=LOST without lostReasonId is almost always a
          // bug (it couldn't possibly know which reason to attach). Reject.
          const stageValue = readWriteField(args.data, "pipelineStage");
          const lostReasonIdValue = readWriteField(args.data, "lostReasonId");
          if (stageValue === "LOST" && !lostReasonIdValue) {
            throw new Prisma.PrismaClientKnownRequestError(
              "Bulk setting leads to LOST is not allowed — provide a lostReasonId or iterate one-by-one.",
              { code: "P2034", clientVersion: "5.22.0" }
            );
          }
          return query(args);
        },
        async upsert({ args, query }) {
          await enforceLostReason(client, args.where, args.update);
          await enforceLostReason(client, args.where, args.create);
          return query(args);
        },
      },
    },
  }) as unknown as PrismaClient;
}

async function enforceLostReason(
  client: PrismaClient,
  where: { id?: string } | Record<string, unknown>,
  data: unknown
): Promise<void> {
  const stageValue = readWriteField(data, "pipelineStage");
  if (stageValue !== "LOST") return;
  const lostReasonIdValue = readWriteField(data, "lostReasonId");
  if (lostReasonIdValue) return;

  // `where` may or may not be a plain id — only check the easy case.
  const id = (where as { id?: string })?.id;
  if (!id) {
    throw new Error(
      "Setting a lead to LOST requires `lostReasonId` (no way to infer the reason)."
    );
  }
  const existing = await client.lead.findUnique({
    where: { id },
    select: { lostReasonId: true },
  });
  if (!existing?.lostReasonId) {
    throw new Error(
      "Setting this lead to LOST requires `lostReasonId` — pick a reason before marking it lost."
    );
  }
}

/**
 * Read a Prisma update-field value that may be either a bare value or an
 * update operator object like `{ set: 'WON' }`. Handles both shapes without
 * knowing the concrete field type.
 */
function readWriteField(data: unknown, field: string): unknown {
  if (!data || typeof data !== "object") return undefined;
  const raw = (data as Record<string, unknown>)[field];
  if (raw && typeof raw === "object" && "set" in raw) {
    return (raw as { set: unknown }).set;
  }
  return raw;
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
