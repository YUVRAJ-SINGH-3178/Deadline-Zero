import type { Pool } from "pg";
import type { UserState } from "./domain.js";

const empty = (): UserState => ({
  tasks: [],
  availability: [],
  history: [],
  revision: 0,
});
export class ConcurrentUpdateError extends Error {
  constructor() {
    super("This plan changed in another request.");
    this.name = "ConcurrentUpdateError";
  }
}
/** Demo adapter is process-local. Production uses PostgreSQL JSON state per account. */
export class Store {
  private memory = new Map<string, UserState>();
  constructor(private pool?: Pool) {}
  async get(userId: string): Promise<UserState> {
    if (!this.pool) return structuredClone(this.memory.get(userId) ?? empty());
    const { rows } = await this.pool.query<{
      state: Omit<UserState, "revision">;
      revision: string | number;
      deleted: boolean;
    }>("SELECT state, revision, deleted FROM user_state WHERE user_id = $1", [
      userId,
    ]);
    if (!rows[0]) return empty();
    return rows[0].deleted
      ? { ...empty(), revision: Number(rows[0].revision), deleted: true }
      : {
          ...rows[0].state,
          revision: Number(rows[0].revision),
          deleted: false,
        };
  }
  async put(userId: string, state: UserState): Promise<void> {
    if (!this.pool) {
      const current = this.memory.get(userId);
      if (current && current.revision !== state.revision)
        throw new ConcurrentUpdateError();
      state.revision += 1;
      state.deleted = false;
      this.memory.set(userId, structuredClone(state));
      return;
    }
    const { rows } = await this.pool.query<{ revision: number }>(
      "INSERT INTO user_state(user_id,state,revision,deleted,updated_at) VALUES($1,$2::jsonb,1,false,now()) ON CONFLICT(user_id) DO UPDATE SET state=EXCLUDED.state, revision=user_state.revision+1, deleted=false, updated_at=now() WHERE user_state.revision=$3 RETURNING revision",
      [userId, JSON.stringify(state), state.revision],
    );
    if (!rows[0]) throw new ConcurrentUpdateError();
    state.revision = Number(rows[0].revision);
    state.deleted = false;
  }
  async delete(userId: string, expectedRevision: number): Promise<void> {
    if (!this.pool) {
      const current = this.memory.get(userId);
      if (current && current.revision !== expectedRevision)
        throw new ConcurrentUpdateError();
      this.memory.set(userId, {
        ...empty(),
        revision: expectedRevision + 1,
        deleted: true,
      });
      return;
    }
    const { rows } = await this.pool.query<{ revision: number }>(
      "INSERT INTO user_state(user_id,state,revision,deleted,updated_at) VALUES($1,$2::jsonb,1,true,now()) ON CONFLICT(user_id) DO UPDATE SET state=$2::jsonb, revision=user_state.revision+1, deleted=true, updated_at=now() WHERE user_state.revision=$3 RETURNING revision",
      [userId, JSON.stringify(empty()), expectedRevision],
    );
    if (!rows[0]) throw new ConcurrentUpdateError();
  }
  async seed(userId = "local-user") {
    const now = new Date();
    const at = (mins: number) =>
      new Date(now.getTime() + mins * 60_000).toISOString();
    const s = await this.get(userId);
    s.tasks = [];
    s.availability = [];
    s.history = [];
    delete s.plan;
    delete s.deleted;
    s.availability = [
      { start: at(90), end: at(150), label: "Dinner" },
      { start: at(240), end: at(300), label: "Unavailable" },
    ];
    const make = (
      title: string,
      minutes: number,
      deadlineMinutes: number,
      priority: "HIGH" | "CRITICAL" | "MEDIUM",
      flexibility: "FLEXIBLE" | "FIXED" | "OPTIONAL",
    ) => ({
      id: crypto.randomUUID(),
      title,
      estimatedDurationMinutes: minutes,
      remainingDurationMinutes: minutes,
      deadline: at(deadlineMinutes),
      priority,
      flexibility,
      dependencies: [],
      status: "TODO" as const,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    s.tasks = [
      make("Finish assignment", 90, 420, "CRITICAL", "FLEXIBLE"),
      make("Study three exam chapters", 120, 900, "HIGH", "FLEXIBLE"),
      make("Dinner", 45, 160, "MEDIUM", "FIXED"),
      make("Organize desk", 30, 900, "MEDIUM", "OPTIONAL"),
    ];
    await this.put(userId, s);
    return s;
  }
}
