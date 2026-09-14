import { PageHeader, EmptyState } from "@/components/ui";

// TODO(phase-c): Settings screen — Profile, AI, Bank, Wedding, Notifications,
// Data cards (DESIGN.md §6). The underlying settings routes ship in Phase A.
export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" subtitle="Profile · AI · Bank · Wedding · Data" />
      <EmptyState
        title="Settings screens come in Phase C"
        description="Profile, AI model choice, bank connections, wedding details and data export will render here."
      />
    </div>
  );
}
