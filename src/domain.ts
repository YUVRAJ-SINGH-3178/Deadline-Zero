import { randomUUID } from "node:crypto";
import { z } from "zod";

export const Priority = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const Flexibility = z.enum(["FIXED", "FLEXIBLE", "OPTIONAL"]);
export const Status = z.enum([
  "TODO",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "BLOCKED",
]);
export const TaskInput = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().max(2000).optional(),
  notes: z.string().max(1000).optional(),
  category: z.string().trim().max(80).optional(),
  deadline: z.string().datetime({ offset: true }).optional(),
  earliestStart: z.string().datetime({ offset: true }).optional(),
  latestStart: z.string().datetime({ offset: true }).optional(),
  estimatedDurationMinutes: z.number().int().min(5).max(1440),
  priority: Priority.default("MEDIUM"),
  flexibility: Flexibility.default("FLEXIBLE"),
  dependencies: z.array(z.string().uuid()).max(20).default([]),
});
export const TaskPatch = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().max(2000).optional(),
    notes: z.string().max(1000).optional(),
    category: z.string().trim().max(80).optional(),
    deadline: z.string().datetime({ offset: true }).nullable().optional(),
    earliestStart: z.string().datetime({ offset: true }).nullable().optional(),
    latestStart: z.string().datetime({ offset: true }).nullable().optional(),
    estimatedDurationMinutes: z.number().int().min(5).max(1440).optional(),
    priority: Priority.optional(),
    flexibility: Flexibility.optional(),
    status: Status.optional(),
  })
  .strict()
  .refine(
    (v) => Object.keys(v).length > 0,
    "Provide at least one field to update",
  );
export type Task = z.infer<typeof TaskInput> & {
  id: string;
  status: z.infer<typeof Status>;
  remainingDurationMinutes: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};
export type Block = {
  taskId: string;
  title: string;
  start: string;
  end: string;
  durationMinutes: number;
  reason: string;
};
export type Plan = {
  id: string;
  version: number;
  createdAt: string;
  windowStart: string;
  windowEnd: string;
  blocks: Block[];
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  warnings: string[];
  reasoningSummary: string;
};
export type UserState = {
  /** Persistence concurrency token; never sent to customers. */
  revision: number;
  /** Minimal deletion tombstone; prevents a stale concurrent write from restoring erased data. */
  deleted?: boolean;
  requestCache?: Record<
    string,
    { expiresAt: string; response: Record<string, unknown> }
  >;
  tasks: Task[];
  availability: { start: string; end: string; label?: string }[];
  plan?: Plan;
  history: {
    reason: string;
    at: string;
    changes: string[];
    previousPlan?: Plan;
    newPlan: Plan;
  }[];
  focusSession?: { taskId: string; startedAt: string };
};

export function newTask(input: z.infer<typeof TaskInput>): Task {
  const now = new Date().toISOString();
  return {
    ...input,
    deadline: input.deadline
      ? new Date(input.deadline).toISOString()
      : undefined,
    earliestStart: input.earliestStart
      ? new Date(input.earliestStart).toISOString()
      : undefined,
    latestStart: input.latestStart
      ? new Date(input.latestStart).toISOString()
      : undefined,
    id: randomUUID(),
    status: "TODO",
    remainingDurationMinutes: input.estimatedDurationMinutes,
    createdAt: now,
    updatedAt: now,
  };
}
export function publicTask(t: Task) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    deadline: t.deadline,
    earliestStart: t.earliestStart,
    latestStart: t.latestStart,
    category: t.category,
    notes: t.notes,
    estimatedDurationMinutes: t.estimatedDurationMinutes,
    remainingDurationMinutes: t.remainingDurationMinutes,
    priority: t.priority,
    flexibility: t.flexibility,
    status: t.status,
  };
}
