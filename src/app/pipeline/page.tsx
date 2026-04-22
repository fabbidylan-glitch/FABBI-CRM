import { Shell } from "@/components/shell";
import { PipelineBoard } from "@/components/pipeline-board";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { config } from "@/lib/config";
import { getPipelineBoard } from "@/lib/features/pipeline/queries";
import { listActiveLostReasons } from "@/lib/features/users/queries";

export default async function PipelinePage() {
  const [board, lostReasons] = await Promise.all([
    getPipelineBoard(),
    listActiveLostReasons(),
  ]);
  const canEdit = config.dbEnabled && config.authEnabled;

  return (
    <Shell title="Pipeline">
      <PipelineBoard board={board} canEdit={canEdit} lostReasons={lostReasons} />
    </Shell>
  );
}
