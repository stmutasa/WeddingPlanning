"use client";

import { useState } from "react";
import useSWR from "swr";
import { apiPatch, apiPost, fetcher } from "@/lib/api";
import { useAiEnabled, useCatalog, useMe, useRefreshAll } from "@/lib/hooks";
import { daysUntil, shortDate } from "@/lib/dates";
import {
  isDisabled,
  type MaybeDisabled,
  type TaskDto,
  type TimelineDraftDto,
} from "@/lib/api-types";
import {
  Button,
  Card,
  EmptyState,
  Input,
  SectionLabel,
  Select,
  Sheet,
  useToast,
} from "@/components/ui";
import {
  Banner,
  EventChip,
  NeutralBadge,
  PersonDotName,
  RowsSkeleton,
  hueForUser,
} from "@/components/common";

type Group = "Overdue" | "Today" | "Upcoming" | "Someday";

/** Plan › Tasks (DESIGN.md §6): grouped list, quick add, AI timeline review. */
export function TasksTab() {
  const { data, mutate } = useSWR<TaskDto[]>("/api/tasks?status=OPEN", fetcher);
  const done = useSWR<TaskDto[]>("/api/tasks?status=DONE", fetcher);
  const catalog = useCatalog();
  const { me } = useMe();
  const { toast } = useToast();
  const refreshAll = useRefreshAll();

  const [title, setTitle] = useState("");
  const [eventId, setEventId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<TimelineDraftDto | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [aiFailed, setAiFailed] = useState(false);
  const ai = useAiEnabled();
  const [error, setError] = useState<string | null>(null);
  const [justDone, setJustDone] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  async function add() {
    if (!title.trim()) return;
    setAdding(true);
    try {
      await apiPost("/api/tasks", {
        title: title.trim(),
        eventId: eventId || null,
        dueDate: dueDate || null,
        assigneeId: assigneeId || null,
      });
      setTitle("");
      setDueDate("");
      await mutate();
      refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that task");
    } finally {
      setAdding(false);
    }
  }

  async function complete(task: TaskDto) {
    setJustDone(task.id);
    try {
      await apiPatch(`/api/tasks/${task.id}`, { status: "DONE" });
      await mutate();
      await done.mutate();
      refreshAll();
    } finally {
      setTimeout(() => setJustDone(null), 400);
    }
  }

  async function reopen(task: TaskDto) {
    await apiPatch(`/api/tasks/${task.id}`, { status: "OPEN" });
    await mutate();
    await done.mutate();
  }

  async function generate() {
    setDrafting(true);
    setError(null);
    try {
      const result = await apiPost<MaybeDisabled<TimelineDraftDto>>("/api/ai/timeline", {
        apply: false,
      });
      if (isDisabled(result)) {
        setAiFailed(true);
        return;
      }
      setDraft(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The timeline could not be drafted");
    } finally {
      setDrafting(false);
    }
  }

  /**
   * Applies exactly the list that was reviewed, one task at a time, rather
   * than asking the model a second time: `/api/ai/timeline` with
   * `apply: true` would redraft, and the person already said yes to this
   * list. Titles that already exist are skipped here too.
   */
  async function applyDraft() {
    if (!draft) return;
    setApplying(true);
    try {
      const existing = new Set((data ?? []).map((t) => t.title.trim().toLowerCase()));
      let created = 0;
      for (const task of draft.drafted) {
        if (existing.has(task.title.trim().toLowerCase())) continue;
        const event = catalog.events.find((e) => e.slug === task.eventSlug);
        const assignee = catalog.people.find(
          (p) => p.name.toLowerCase() === (task.suggestedAssignee ?? "").toLowerCase(),
        );
        await apiPost("/api/tasks", {
          title: task.title,
          notes: task.notes,
          dueDate: task.dueDate,
          eventId: event?.id ?? null,
          assigneeId: assignee?.userId ?? null,
          priority: task.priority,
          milestone: task.milestone,
        });
        created += 1;
      }
      toast(`Added ${created} ${created === 1 ? "task" : "tasks"}`);
      setDraft(null);
      await mutate();
      refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply the timeline");
    } finally {
      setApplying(false);
    }
  }

  const groups: Record<Group, TaskDto[]> = { Overdue: [], Today: [], Upcoming: [], Someday: [] };
  for (const task of data ?? []) {
    if (!task.dueDate) groups.Someday.push(task);
    else {
      const days = daysUntil(task.dueDate);
      if (days < 0) groups.Overdue.push(task);
      else if (days === 0) groups.Today.push(task);
      else groups.Upcoming.push(task);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <SectionLabel>Add a task</SectionLabel>
        <div className="flex flex-col gap-3">
          <Input
            label="Title"
            placeholder="Book the tent hire"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void add();
            }}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select label="Event" value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="">No event</option>
              {catalog.events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </Select>
            <Input
              label="Due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <Select
              label="Assignee"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
            >
              <option value="">Nobody yet</option>
              {catalog.people.map((person) => (
                <option key={person.userId} value={person.userId}>
                  {person.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={add} disabled={adding || !title.trim()}>
              {adding ? "Adding…" : "Add task"}
            </Button>
            {!aiFailed && ai.enabled ? (
              <Button variant="secondary" onClick={generate} disabled={drafting}>
                {drafting ? "Drafting…" : "Generate timeline"}
              </Button>
            ) : null}
          </div>
          {aiFailed || (ai.ready && !ai.enabled) ? (
            <p className="text-xs text-ink-soft">
              The assistant is off, so the timeline is yours to write.
            </p>
          ) : null}
        </div>
      </Card>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      {!data ? (
        <RowsSkeleton rows={5} title />
      ) : data.length === 0 ? (
        <EmptyState
          title="No open tasks"
          description="Add one above, or let the assistant draft the Kenyan wedding sequence from the date."
        />
      ) : (
        (Object.keys(groups) as Group[])
          .filter((group) => groups[group].length > 0)
          .map((group) => (
            <Card key={group}>
              <SectionLabel>
                {group} · {groups[group].length}
              </SectionLabel>
              <ul className="flex flex-col">
                {groups[group].map((task) => (
                  <li
                    key={task.id}
                    className="flex items-start gap-3 border-t border-line py-2 first:border-t-0"
                  >
                    <button
                      onClick={() => complete(task)}
                      aria-label={`Complete ${task.title}`}
                      className={`focus-ring mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
                        justDone === task.id ? "animate-check-pop" : ""
                      }`}
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded border-2 border-ink text-xs text-ink" />
                    </button>
                    <span className="min-w-0 flex-1 py-2">
                      <span className="block text-[15px] font-semibold text-ink">{task.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                        {task.event ? (
                          <EventChip slug={task.event.slug} name={task.event.name} />
                        ) : null}
                        {task.dueDate ? <span>{shortDate(task.dueDate, me?.timezone)}</span> : null}
                        {task.milestone ? <NeutralBadge>milestone</NeutralBadge> : null}
                        {task.assigneeId ? (
                          <PersonDotName
                            name={
                              catalog.people.find((p) => p.userId === task.assigneeId)?.name ??
                              task.assignee?.name ??
                              "Assigned"
                            }
                            hue={hueForUser(task.assigneeId, catalog.people)}
                          />
                        ) : null}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ))
      )}

      <Card>
        <button
          onClick={() => setShowDone((v) => !v)}
          className="focus-ring flex min-h-11 w-full items-center justify-between"
        >
          <SectionLabel>Done · {done.data?.length ?? 0}</SectionLabel>
          <span className="text-sm text-ink-soft">{showDone ? "Hide" : "Show"}</span>
        </button>
        {showDone ? (
          <ul className="flex flex-col">
            {(done.data ?? []).map((task) => (
              <li
                key={task.id}
                className="flex items-center justify-between gap-3 border-t border-line py-2 text-sm first:border-t-0"
              >
                <span className="text-ink-soft line-through">{task.title}</span>
                <button
                  onClick={() => reopen(task)}
                  className="focus-ring min-h-11 px-2 text-xs font-semibold uppercase tracking-wide text-primary"
                >
                  Reopen
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Sheet
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title="Drafted timeline"
        className="max-h-[92vh] overflow-y-auto"
      >
        {draft ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-soft">
              {draft.drafted.length} tasks, in the Kenyan wedding sequence. Nothing is written until
              you apply, and titles you already have are skipped.
            </p>
            <ul className="flex flex-col gap-1 text-sm">
              {draft.drafted.map((task, i) => (
                <li
                  key={i}
                  className="flex justify-between gap-3 border-t border-line pt-1 first:border-t-0"
                >
                  <span className="text-ink">{task.title}</span>
                  <span className="shrink-0 text-xs text-ink-soft">
                    {task.dueDate}
                    {task.eventSlug ? ` · ${task.eventSlug}` : ""}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setDraft(null)}>
                Discard
              </Button>
              <Button className="flex-1" onClick={applyDraft} disabled={applying}>
                {applying ? "Applying…" : "Apply"}
              </Button>
            </div>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
