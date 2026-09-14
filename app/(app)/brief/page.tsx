import { PageHeader, EmptyState } from "@/components/ui";

// TODO(phase-c): Brief screen — rendered markdown, copy/download, token URL,
// Drive sync toggle (DESIGN.md §6, §8). The generator itself is Phase B.
export default function BriefPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Brief" subtitle="For pasting into any AI chat" />
      <EmptyState
        title="The Brief generator is Phase B"
        description="Once brief.generate() ships, the latest snapshot, the token link and Drive sync will render here."
      />
    </div>
  );
}
