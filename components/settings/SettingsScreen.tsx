"use client";

import { PageHeader } from "@/components/ui";
import { ProfileCard } from "./ProfileCard";
import { AiCard } from "./AiCard";
import { BankCard } from "./BankCard";
import { WeddingCard } from "./WeddingCard";
import { NotificationsCard } from "./NotificationsCard";
import { DataCard } from "./DataCard";

/** Settings (DESIGN.md §6): profile, AI, bank, wedding, notifications, data. */
export function SettingsScreen({ appName }: { appName: string }) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Settings" subtitle={`${appName} · just the two of you`} />
      <ProfileCard />
      <AiCard />
      <BankCard />
      <WeddingCard />
      <NotificationsCard appName={appName} />
      <DataCard />
    </div>
  );
}
