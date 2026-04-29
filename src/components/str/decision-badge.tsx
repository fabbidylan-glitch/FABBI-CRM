import { RawPill } from "@/components/ui";
import {
  DECISION_CLASSES,
  DECISION_LABEL,
  type DecisionLabel,
} from "@/lib/features/str/format";

/** Color-coded pill for a deal's decision recommendation.
 * Renders an em-dash if the score hasn't been computed yet. */
export function DecisionBadge({ decision }: { decision: DecisionLabel }) {
  if (!decision) {
    return <span className="text-xs text-brand-muted">—</span>;
  }
  return (
    <RawPill className={DECISION_CLASSES[decision]}>
      {DECISION_LABEL[decision]}
    </RawPill>
  );
}
