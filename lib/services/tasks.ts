import type { Task } from "@prisma/client";
import type { TaskPriority } from "@/lib/types";
import { NotImplemented } from "./errors";

export interface TaskInput {
  title: string;
  notes?: string | null;
  dueDate?: Date | null;
  eventId?: string | null;
  assigneeId?: string | null;
  priority?: TaskPriority;
  milestone?: boolean;
}

export async function create(_userId: string, _input: TaskInput): Promise<Task> {
  throw new NotImplemented("tasks.create");
}

export async function update(
  _userId: string,
  _id: string,
  _input: Partial<TaskInput> & { status?: "OPEN" | "DONE" }
): Promise<Task> {
  throw new NotImplemented("tasks.update");
}

export async function remove(_userId: string, _id: string): Promise<void> {
  throw new NotImplemented("tasks.delete");
}

export async function list(_filters: { status?: string; eventId?: string }): Promise<Task[]> {
  throw new NotImplemented("tasks.list");
}

export async function reorder(_ids: string[]): Promise<void> {
  throw new NotImplemented("tasks.reorder");
}

/** PROMPTS.md §6 — idempotent: skips titles that already exist (case-insensitive). */
export async function generateTimeline(): Promise<Task[]> {
  throw new NotImplemented("tasks.generateTimeline");
}
