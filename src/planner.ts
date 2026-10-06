import { randomUUID } from "node:crypto";
import type { Plan, Task, UserState, Block } from "./domain.js";
import { MockCalendarProvider } from "./calendar.js";

const priorityWeight = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 } as const;
function score(t: Task, now: number): number {
  const hours = t.deadline ? (Date.parse(t.deadline) - now) / 3_600_000 : 240;
  const urgency = hours <= 0 ? 1000 : Math.max(0, 72 - hours) / 8;
  const effort = Math.min(8, t.remainingDurationMinutes / 60);
  return (
    urgency +
    priorityWeight[t.priority] * 8 +
    (t.flexibility === "FIXED" ? 6 : t.flexibility === "OPTIONAL" ? -12 : 0) -
    effort
  );
}

/** Stable, deterministic earliest-deadline scheduler. Reserves unavailable intervals, respects dependencies, and emits explicit unscheduled risk. */
export function createPlan(
  state: UserState,
  windowStart: string,
  windowEnd: string,
  now = new Date(),
): Plan {
  const requestedStart = Date.parse(windowStart),
    finish = Date.parse(windowEnd);
  const begin = Math.max(requestedStart, now.getTime());
  if (!Number.isFinite(begin) || !Number.isFinite(finish) || finish <= begin)
    throw new Error("Planning window end must be after its start.");
  if (finish - begin > 7 * 24 * 60 * 60_000)
    throw new Error("Planning window cannot exceed seven days.");
  const available = [{ start: begin, end: finish }];
  const unavailable = new MockCalendarProvider(state.availability);
  const effectiveStart = new Date(begin).toISOString();
  const windows = unavailable.getUnavailableWindows(effectiveStart, windowEnd);
  for (const a of windows) {
    const s = Date.parse(a.start),
      e = Date.parse(a.end);
    if (s < e && e > begin && s < finish) {
      const next: typeof available = [];
      for (const w of available) {
        if (e <= w.start || s >= w.end) next.push(w);
        else {
          if (s > w.start) next.push({ start: w.start, end: s });
          if (e < w.end) next.push({ start: e, end: w.end });
        }
      }
      available.splice(0, available.length, ...next);
    }
  }
  const pending = state.tasks.filter(
    (t) =>
      ["TODO", "IN_PROGRESS", "BLOCKED"].includes(t.status) &&
      t.remainingDurationMinutes > 0,
  );
  const order = (a: Task, b: Task) =>
    score(b, now.getTime()) - score(a, now.getTime()) ||
    (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999") ||
    a.createdAt.localeCompare(b.createdAt);
  const ready = new Set(
    state.tasks.filter((t) => t.status === "COMPLETED").map((t) => t.id),
  );
  const blocks: Block[] = [],
    warnings: string[] = [];
  const remainingTasks = new Map(pending.map((task) => [task.id, task]));
  const dependents = new Map<string, Task[]>();
  for (const task of pending) {
    for (const dependencyId of task.dependencies) {
      if (!remainingTasks.has(dependencyId)) continue;
      const children = dependents.get(dependencyId) ?? [];
      children.push(task);
      dependents.set(dependencyId, children);
    }
  }
  const candidates = pending
    .filter((task) => task.dependencies.every((id) => ready.has(id)))
    .sort(order);
  const queued = new Set(candidates.map((task) => task.id));
  while (candidates.length) {
    const task = candidates.shift()!;
    remainingTasks.delete(task.id);
    let remaining = task.remainingDurationMinutes;
    for (let i = 0; i < available.length && remaining > 0; i++) {
      const w = available[i]!;
      const earliestStart = task.earliestStart
        ? Date.parse(task.earliestStart)
        : Number.NEGATIVE_INFINITY;
      const latestStart = task.latestStart
        ? Date.parse(task.latestStart)
        : Number.POSITIVE_INFINITY;
      if (w.end <= earliestStart || w.start > latestStart) continue;
      if (w.start < earliestStart) {
        const originalEnd = w.end;
        available.splice(
          i,
          1,
          { start: w.start, end: earliestStart },
          { start: earliestStart, end: originalEnd },
        );
        continue;
      }
      const deadline = task.deadline ? Date.parse(task.deadline) : finish;
      const endBound = Math.min(w.end, deadline);
      const minutes = Math.floor((endBound - w.start) / 60_000);
      if (minutes < 15) continue;
      const chunk = Math.min(remaining, minutes);
      blocks.push({
        taskId: task.id,
        title: task.title,
        start: new Date(w.start).toISOString(),
        end: new Date(w.start + chunk * 60_000).toISOString(),
        durationMinutes: chunk,
        reason: task.deadline
          ? `Prioritized for ${new Date(task.deadline).toLocaleString()}.`
          : `${task.priority.toLowerCase()} priority.`,
      });
      remaining -= chunk;
      w.start += chunk * 60_000;
    }
    if (remaining > 0)
      warnings.push(
        `${task.title} has ${remaining} minutes unscheduled${task.deadline ? " before its deadline" : ""}.`,
      );
    else {
      ready.add(task.id);
      for (const child of dependents.get(task.id) ?? []) {
        if (
          remainingTasks.has(child.id) &&
          !queued.has(child.id) &&
          child.dependencies.every((id) => ready.has(id))
        ) {
          candidates.push(child);
          queued.add(child.id);
        }
      }
      candidates.sort(order);
    }
  }
  for (const task of remainingTasks.values())
    warnings.push(`${task.title} is waiting for a prerequisite.`);
  blocks.sort((a, b) => a.start.localeCompare(b.start));
  const unresolved = warnings.length,
    riskLevel = unresolved > 1 ? "HIGH" : unresolved ? "MEDIUM" : "LOW";
  return {
    id: randomUUID(),
    version: (state.plan?.version ?? 0) + 1,
    createdAt: now.toISOString(),
    windowStart: effectiveStart,
    windowEnd,
    blocks,
    riskLevel,
    warnings,
    reasoningSummary: blocks.length
      ? `Scheduled ${new Set(blocks.map((b) => b.taskId)).size} tasks in dependency, deadline, and priority order, preserving unavailable time.`
      : "No tasks fit the selected planning window.",
  };
}

export function actionFor(state: UserState, now = new Date()) {
  const t =
    state.plan?.blocks.find(
      (b) =>
        Date.parse(b.start) <= now.getTime() &&
        Date.parse(b.end) > now.getTime(),
    ) ?? state.plan?.blocks.find((b) => Date.parse(b.start) > now.getTime());
  if (!t)
    return {
      action: "Choose one task to work on",
      reason:
        "There is no active plan block. Create or refresh your plan to find a good next step.",
    };
  return {
    action: `${t.title} · ${t.durationMinutes} minutes`,
    reason: `It is the next scheduled block, selected to protect your deadline.`,
  };
}

export function replan(
  state: UserState,
  reason: string,
  now: Date,
  windowHours = 24,
) {
  const old = state.plan;
  const start = now.toISOString(),
    end = new Date(now.getTime() + windowHours * 3_600_000).toISOString();
  const next = createPlan(state, start, end, now);
  const oldStarts = new Map(
    (old?.blocks ?? []).map((b) => [b.taskId, b.start]),
  );
  const changes = next.blocks
    .filter((b) => oldStarts.get(b.taskId) !== b.start)
    .map(
      (b) =>
        `${b.title} moved to ${new Date(b.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
    );
  state.plan = next;
  state.history.push({
    reason,
    at: now.toISOString(),
    changes,
    ...(old ? { previousPlan: old } : {}),
    newPlan: next,
  });
  if (state.history.length > 100)
    state.history.splice(0, state.history.length - 100);
  return {
    previousPlan: old,
    newPlan: next,
    changes,
    affectedTasks: [...new Set(changes.map((c) => c.split(" moved ")[0]))],
    riskChanges: { before: old?.riskLevel ?? "UNKNOWN", after: next.riskLevel },
    explanation: changes.length
      ? `I rebuilt the remaining schedule after “${reason}” and moved ${changes.length} block${changes.length === 1 ? "" : "s"}.`
      : `I rebuilt the schedule after “${reason}”; no existing block needed to move.`,
  };
}

export function simulateSkip(
  state: UserState,
  taskId: string,
  now = new Date(),
) {
  const source = state.tasks.find((t) => t.id === taskId);
  if (!source)
    throw new Error("Task not found. Ask for its name or capture it first.");
  const clone: UserState = structuredClone(state);
  const task = clone.tasks.find((t) => t.id === taskId)!;
  task.status = "CANCELLED";
  const simulatedPlan = createPlan(
    clone,
    state.plan?.windowStart ?? now.toISOString(),
    state.plan?.windowEnd ??
      new Date(now.getTime() + 24 * 3600000).toISOString(),
    now,
  );
  return {
    beforePlan: state.plan,
    afterPlan: simulatedPlan,
    simulatedPlan,
    impact: `${source.remainingDurationMinutes} minutes freed; dependent tasks may be delayed.`,
    riskChange: {
      before: state.plan?.riskLevel ?? "UNKNOWN",
      after: simulatedPlan.riskLevel,
    },
    affectedTasks: simulatedPlan.warnings,
    recommendation:
      simulatedPlan.riskLevel === "HIGH"
        ? "Keep a shorter study block to reduce deadline risk."
        : "This looks manageable, but review the next plan before deciding.",
  };
}
