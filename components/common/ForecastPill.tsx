import type { ForecastStatus } from "@/lib/types";
import { StatusPill, type SemanticStatus } from "@/components/ui";

const TONE: Record<ForecastStatus, SemanticStatus> = {
  ON_TRACK: "ok",
  AT_RISK: "warn",
  OVER: "danger",
};

const LABEL: Record<ForecastStatus, string> = {
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  OVER: "Over",
};

/** Outlined semantic pill for a forecast status (DESIGN.md §1 thresholds). */
export function ForecastPill({
  status,
  className,
}: {
  status: ForecastStatus;
  className?: string;
}) {
  return (
    <StatusPill status={TONE[status]} className={className}>
      {LABEL[status]}
    </StatusPill>
  );
}
