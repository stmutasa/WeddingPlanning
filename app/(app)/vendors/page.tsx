import { PageHeader } from "@/components/ui";
import { VendorsTab } from "@/components/vendors/VendorsTab";

/** The More-menu entry; the same component Money › Vendors renders. */
export default function VendorsPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Vendors" subtitle="Quotes, contacts and payment schedules" />
      <VendorsTab />
    </div>
  );
}
