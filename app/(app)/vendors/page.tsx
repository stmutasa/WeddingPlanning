import { PageHeader, EmptyState } from "@/components/ui";

// TODO(phase-c): Vendors screen — status cards, contact tap-to-call/WhatsApp,
// payment schedule editor, attachments, contract summary (DESIGN.md §6).
export default function VendorsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Vendors" subtitle="Status · Payments · Contacts" />
      <EmptyState
        title="Vendors screen comes in Phase C"
        description="Vendor cards, payment schedules and contract summaries will render here."
      />
    </div>
  );
}
