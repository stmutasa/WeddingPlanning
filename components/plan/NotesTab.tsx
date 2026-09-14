"use client";

import { useState } from "react";
import useSWR from "swr";
import { apiDelete, apiPatch, apiPost, fetcher } from "@/lib/api";
import { useMe, useRefreshAll } from "@/lib/hooks";
import { longDate } from "@/lib/dates";
import { USER_NOTE_KINDS, type UserNoteKind } from "@/lib/types";
import type { NoteDto } from "@/lib/api-types";
import { Button, Card, EmptyState, Input, Sheet, Tabs, Textarea, useToast } from "@/components/ui";
import { NeutralBadge, RowsSkeleton } from "@/components/common";

/** Plan › Notes (DESIGN.md §6): kind chips, pinned first; DIGEST never shows. */
export function NotesTab() {
  const { data, mutate } = useSWR<NoteDto[]>("/api/notes", fetcher);
  const { me } = useMe();
  const { toast } = useToast();
  const refreshAll = useRefreshAll();
  const [kind, setKind] = useState("ALL");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [noteKind, setNoteKind] = useState<UserNoteKind>("NOTE");
  const [saving, setSaving] = useState(false);

  // The weekly digest is stored as a Note of kind DIGEST; it belongs to the
  // Home card, not to this list.
  const notes = (data ?? [])
    .filter((note) => note.kind !== "DIGEST")
    .filter((note) => kind === "ALL" || note.kind === kind);

  async function save() {
    if (!body.trim()) return;
    setSaving(true);
    try {
      await apiPost("/api/notes", {
        kind: noteKind,
        title: title.trim() || null,
        body: body.trim(),
      });
      toast("Note saved");
      setTitle("");
      setBody("");
      setOpen(false);
      await mutate();
      refreshAll();
    } finally {
      setSaving(false);
    }
  }

  async function togglePin(note: NoteDto) {
    await apiPatch(`/api/notes/${note.id}`, { pinned: !note.pinned });
    await mutate();
  }

  async function remove(note: NoteDto) {
    await apiDelete(`/api/notes/${note.id}`);
    await mutate();
    refreshAll();
  }

  return (
    <div className="flex flex-col gap-3">
      <Tabs
        value={kind}
        onChange={setKind}
        items={[
          { value: "ALL", label: "All" },
          ...USER_NOTE_KINDS.map((k) => ({
            value: k,
            label: k.charAt(0) + k.slice(1).toLowerCase(),
          })),
        ]}
      />

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          New note
        </Button>
      </div>

      {!data ? (
        <RowsSkeleton rows={3} />
      ) : notes.length === 0 ? (
        <EmptyState
          title="Nothing written down yet"
          description="Decisions, ideas and open questions live here — and the Brief carries them into any AI chat."
          action={<Button onClick={() => setOpen(true)}>New note</Button>}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {notes.map((note) => (
            <Card key={note.id}>
              <div className="mb-1 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {note.title ? (
                    <p className="font-display text-[15px] font-bold text-ink">{note.title}</p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <NeutralBadge>{note.kind.toLowerCase()}</NeutralBadge>
                    {note.pinned ? <NeutralBadge>pinned</NeutralBadge> : null}
                    <span className="text-xs text-ink-soft">
                      {longDate(note.updatedAt, me?.timezone)}
                    </span>
                  </div>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm text-ink">{note.body}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => togglePin(note)}>
                  {note.pinned ? "Unpin" : "Pin"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(note)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="New note">
        <div className="flex flex-col gap-3">
          <Tabs
            value={noteKind}
            onChange={(value) => setNoteKind(value as UserNoteKind)}
            items={USER_NOTE_KINDS.map((k) => ({
              value: k,
              label: k.charAt(0) + k.slice(1).toLowerCase(),
            }))}
          />
          <Input label="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea label="Note" rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
          <Button onClick={save} disabled={saving || !body.trim()}>
            {saving ? "Saving…" : "Save note"}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
