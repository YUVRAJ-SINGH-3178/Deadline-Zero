import { describe, expect, it } from "vitest";
import { createPlan, simulateSkip, replan } from "../src/planner.js";
import { newTask, TaskInput, type UserState } from "../src/domain.js";
const now = new Date("2026-10-07T18:00:00.000Z");
function state(): UserState {
  const a = newTask(
    TaskInput.parse({
      title: "Assignment",
      estimatedDurationMinutes: 60,
      deadline: "2026-10-07T23:00:00.000Z",
      priority: "CRITICAL",
    }),
  );
  const b = newTask(
    TaskInput.parse({
      title: "Study",
      estimatedDurationMinutes: 90,
      deadline: "2026-10-08T08:00:00.000Z",
    }),
  );
  return {
    tasks: [a, b],
    availability: [
      { start: "2026-10-07T19:00:00.000Z", end: "2026-10-07T20:00:00.000Z" },
    ],
    history: [],
    revision: 0,
  };
}
describe("deterministic planner", () => {
  it("places critical deadline work before lower urgency work and avoids unavailable intervals", () => {
    const s = state(),
      p = createPlan(
        s,
        "2026-10-07T18:00:00.000Z",
        "2026-10-08T02:00:00.000Z",
        now,
      );
    expect(p.blocks[0]?.title).toBe("Assignment");
    expect(
      p.blocks.every(
        (b) =>
          !(
            Date.parse(b.start) < Date.parse("2026-10-07T20:00:00Z") &&
            Date.parse(b.end) > Date.parse("2026-10-07T19:00:00Z")
          ),
      ),
    ).toBe(true);
  });
  it("reports work that cannot fit before a deadline", () => {
    const s = state();
    s.tasks[0]!.remainingDurationMinutes = 600;
    expect(
      createPlan(s, "2026-10-07T18:00:00.000Z", "2026-10-07T20:00:00.000Z", now)
        .warnings.length,
    ).toBeGreaterThan(0);
  });
  it("simulates by cloning state and leaves source task and schedule unchanged", () => {
    const s = state();
    s.plan = createPlan(
      s,
      "2026-10-07T18:00:00.000Z",
      "2026-10-08T02:00:00.000Z",
      now,
    );
    const before = structuredClone(s);
    const result = simulateSkip(s, s.tasks[1]!.id, now);
    expect(s).toEqual(before);
    expect(result.simulatedPlan).toBeDefined();
  });
  it("replans with a version increment and a trace of the reason", () => {
    const s = state();
    s.plan = createPlan(
      s,
      "2026-10-07T18:00:00.000Z",
      "2026-10-08T02:00:00.000Z",
      now,
    );
    const result = replan(
      s,
      "running 40 minutes late",
      new Date("2026-10-07T18:40:00Z"),
    );
    expect(result.newPlan.version).toBe(2);
    expect(s.history[0]?.reason).toContain("late");
    expect(s.history[0]?.previousPlan?.version).toBe(1);
    expect(s.history[0]?.newPlan.version).toBe(2);
  });
  it("rejects invalid task input", () =>
    expect(() =>
      TaskInput.parse({ title: "", estimatedDurationMinutes: 0 }),
    ).toThrow());
  it("schedules prerequisites before dependent work even when the dependent task scores higher", () => {
    const prerequisite = newTask(
      TaskInput.parse({
        title: "Prerequisite",
        estimatedDurationMinutes: 30,
        deadline: "2026-10-08T10:00:00.000Z",
        priority: "LOW",
      }),
    );
    const dependent = newTask(
      TaskInput.parse({
        title: "Dependent",
        estimatedDurationMinutes: 30,
        deadline: "2026-10-07T20:00:00.000Z",
        priority: "CRITICAL",
        dependencies: [prerequisite.id],
      }),
    );
    const s: UserState = {
      tasks: [dependent, prerequisite],
      availability: [],
      history: [],
      revision: 0,
    };
    const p = createPlan(
      s,
      "2026-10-07T17:00:00.000Z",
      "2026-10-07T23:00:00.000Z",
      now,
    );
    expect(p.blocks[0]?.taskId).toBe(prerequisite.id);
    expect(p.blocks[1]?.taskId).toBe(dependent.id);
  });
  it("never schedules new work in the past", () => {
    const s = state(),
      p = createPlan(
        s,
        "2026-10-07T17:00:00.000Z",
        "2026-10-08T02:00:00.000Z",
        now,
      );
    expect(p.windowStart).toBe(now.toISOString());
    expect(Date.parse(p.blocks[0]!.start)).toBeGreaterThanOrEqual(
      now.getTime(),
    );
  });
  it("respects earliest and latest task start constraints", () => {
    const scheduled = newTask(
      TaskInput.parse({
        title: "Not before eight",
        estimatedDurationMinutes: 30,
        earliestStart: "2026-10-07T20:00:00.000Z",
        latestStart: "2026-10-07T21:00:00.000Z",
      }),
    );
    const s: UserState = {
      tasks: [scheduled],
      availability: [],
      history: [],
      revision: 0,
    };
    const plan = createPlan(
      s,
      "2026-10-07T18:00:00.000Z",
      "2026-10-07T22:00:00.000Z",
      now,
    );
    expect(plan.blocks[0]?.start).toBe("2026-10-07T20:00:00.000Z");
  });
});
