import { Suspense } from "react";
import { PlanScreen } from "@/components/plan/PlanScreen";
import AppLoading from "../loading";

export default function PlanPage() {
  return (
    <Suspense fallback={<AppLoading />}>
      <PlanScreen />
    </Suspense>
  );
}
