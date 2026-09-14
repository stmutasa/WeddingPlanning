import { Suspense } from "react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { MoneyScreen } from "@/components/money/MoneyScreen";
import AppLoading from "../loading";

export default async function MoneyPage() {
  const session = await auth();
  const funder = session?.user?.id
    ? await db.funder.findUnique({ where: { userId: session.user.id } })
    : null;

  return (
    // useSearchParams needs a Suspense boundary above it (Next docs:
    // functions/use-search-params).
    <Suspense fallback={<AppLoading />}>
      <MoneyScreen defaultFunderId={funder?.id ?? null} />
    </Suspense>
  );
}
