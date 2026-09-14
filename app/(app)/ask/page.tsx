import { PageHeader, EmptyState } from "@/components/ui";

// TODO(phase-c): Ask screen — shared chat threads, streaming assistant
// messages, tool-call cards, suggested prompts (DESIGN.md §6, PROMPTS.md §4).
export default function AskPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Ask" subtitle="Shared assistant" />
      <EmptyState
        title="The assistant arrives in Phase B/C"
        description="A shared chat with the assistant, tool-call cards and suggested prompts will render here."
      />
    </div>
  );
}
