import "server-only";
import { listLeads, type LeadListItem } from "@/lib/features/leads/queries";
import type { Stage } from "@/lib/preview/fixtures";

export async function getPipelineBoard(): Promise<Record<Stage, LeadListItem[]>> {
  const leads = await listLeads();
  const board = {} as Record<Stage, LeadListItem[]>;
  for (const l of leads) {
    if (!board[l.stage]) board[l.stage] = [];
    board[l.stage].push(l);
  }
  return board;
}
