import { auth } from "@/auth";
import { db } from "@/lib/db";
import { HomeScreen } from "@/components/home/HomeScreen";

const appName = process.env.APP_NAME ?? "Harusi";

export default async function HomePage() {
  const session = await auth();
  const funder = session?.user?.id
    ? await db.funder.findUnique({ where: { userId: session.user.id } })
    : null;

  return <HomeScreen appName={appName} defaultFunderId={funder?.id ?? null} />;
}
