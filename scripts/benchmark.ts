import { createPlan } from "../src/planner.js";
import type { UserState } from "../src/domain.js";
const now = new Date();
const tasks = Array.from({ length: 100 }, (_, i) => ({
  id: `task-${i}`,
  title: `Task ${i}`,
  estimatedDurationMinutes: 30 + (i % 4) * 15,
  remainingDurationMinutes: 30 + (i % 4) * 15,
  deadline: new Date(now.getTime() + (i + 1) * 3600000).toISOString(),
  priority: (["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const)[i % 4]!,
  flexibility: "FLEXIBLE" as const,
  dependencies: [],
  status: "TODO" as const,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
}));
const state: UserState = { tasks, availability: [], history: [], revision: 0 };
const durations: number[] = [];
for (let i = 0; i < 1000; i++) {
  const start = performance.now();
  createPlan(
    state,
    now.toISOString(),
    new Date(now.getTime() + 48 * 3600000).toISOString(),
    now,
  );
  durations.push(performance.now() - start);
}
durations.sort((a, b) => a - b);
console.log(
  JSON.stringify(
    {
      runs: durations.length,
      tasks: tasks.length,
      p50Ms: +durations[500]!.toFixed(3),
      p95Ms: +durations[950]!.toFixed(3),
      maxMs: +durations.at(-1)!.toFixed(3),
    },
    null,
    2,
  ),
);
