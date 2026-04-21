import { Shell } from "@/components/shell";
import { PipelineBoard } from "@/components/pipeline-board";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { config } from "@/lib/config";
import { getPipelineBoard } from "@/lib/features/pipeline/queries";

export default async function PipelinePage() {
  const board = await getPipelineBoard();
  const canEdit = config.dbEnabled && config.authEnabled;

  return (
    <Shell title="Pipeline">
      <PipelineBoard board={board} canEdit={canEdit} />
    </Shell>
  );
}
