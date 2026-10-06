import { describe, expect, it } from "vitest";
import { ConcurrentUpdateError, Store } from "../src/store.js";

describe("state persistence safeguards", () => {
  it("rejects stale concurrent writes instead of silently losing an update", async () => {
    const store = new Store();
    const first = await store.get("customer");
    const stale = await store.get("customer");
    first.availability.push({
      start: "2026-10-07T20:00:00Z",
      end: "2026-10-07T21:00:00Z",
    });
    await store.put("customer", first);
    stale.availability.push({
      start: "2026-10-07T22:00:00Z",
      end: "2026-10-07T23:00:00Z",
    });
    await expect(store.put("customer", stale)).rejects.toBeInstanceOf(
      ConcurrentUpdateError,
    );
  });

  it("retains a minimal revision tombstone so stale data cannot return after deletion", async () => {
    const store = new Store();
    const state = await store.get("customer");
    await store.put("customer", state);
    const stale = await store.get("customer");
    await store.delete("customer", stale.revision);
    const erased = await store.get("customer");
    expect(erased.tasks).toEqual([]);
    expect(erased.deleted).toBe(true);
    stale.availability.push({
      start: "2026-10-07T22:00:00Z",
      end: "2026-10-07T23:00:00Z",
    });
    await expect(store.put("customer", stale)).rejects.toBeInstanceOf(
      ConcurrentUpdateError,
    );
  });
});
