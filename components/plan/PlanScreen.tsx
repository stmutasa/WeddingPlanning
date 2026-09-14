"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { PageHeader, Tabs } from "@/components/ui";
import { TasksTab } from "./TasksTab";
import { TimelineTab } from "./TimelineTab";
import { NotesTab } from "./NotesTab";

const TABS = [
  { value: "tasks", label: "Tasks" },
  { value: "timeline", label: "Timeline" },
  { value: "notes", label: "Notes" },
];

/** Plan (DESIGN.md §6): tasks, the month strip, and the shared notebook. */
export function PlanScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = params.get("tab") ?? "tasks";

  const setTab = useCallback(
    (next: string) => {
      const search = new URLSearchParams(params.toString());
      search.set("tab", next);
      router.replace(`${pathname}?${search.toString()}`, { scroll: false });
    },
    [params, pathname, router]
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Plan" subtitle="Tasks, the months ahead, and what you decided" />
      <Tabs items={TABS} value={tab} onChange={setTab} />
      {tab === "tasks" ? <TasksTab /> : null}
      {tab === "timeline" ? <TimelineTab /> : null}
      {tab === "notes" ? <NotesTab /> : null}
    </div>
  );
}
