import Fastify from "fastify";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { Pool } from "pg";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ConcurrentUpdateError, Store } from "./store.js";
import { createPlan, actionFor, replan, simulateSkip } from "./planner.js";
import { TaskInput, TaskPatch, newTask, publicTask } from "./domain.js";

const env = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    HOST: z.string().default("127.0.0.1"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    MCP_BASE_URL: z.string().url().default("http://localhost:3000/mcp"),
    PUBLIC_BASE_URL: z.string().url().optional(),
    DATABASE_URL: z.string().optional(),
    AUTH_MODE: z.enum(["development", "oauth"]).default("development"),
    DEV_BEARER_TOKEN: z.string().min(16).default("local-deadline-zero-token"),
    ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    OAUTH_ISSUER: z.string().url().optional(),
    OAUTH_AUTHORIZATION_ENDPOINT: z.string().url().optional(),
    OAUTH_TOKEN_ENDPOINT: z.string().url().optional(),
    OAUTH_AUDIENCE: z.string().min(1).optional(),
    OAUTH_JWKS_URL: z.string().url().optional(),
  })
  .parse(process.env);
if (env.NODE_ENV === "production" && env.AUTH_MODE !== "oauth")
  throw new Error(
    "Production requires AUTH_MODE=oauth. Development bearer bypass is disabled.",
  );
const pool = env.DATABASE_URL
  ? new Pool({
      connectionString: env.DATABASE_URL,
      max: 10,
      connectionTimeoutMillis: 1500,
      idleTimeoutMillis: 10_000,
    })
  : undefined;
const store = new Store(pool);
const app = Fastify({
  logger: {
    level: env.LOG_LEVEL,
    redact: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers.set-cookie",
    ],
  },
  bodyLimit: 256 * 1024,
  requestIdHeader: "x-request-id",
  genReqId: () => randomUUID(),
});
await app.register(helmet, { contentSecurityPolicy: false });
await app.register(rateLimit, {
  max: 120,
  timeWindow: "1 minute",
  errorResponseBuilder: () => ({
    error: {
      code: "RATE_LIMITED",
      message: "There have been too many requests in a short time.",
      recoverable: true,
      nextAction: "Wait a moment and try again.",
    },
  }),
});

const publicBaseUrl = (
  env.PUBLIC_BASE_URL ?? env.MCP_BASE_URL.replace(/\/mcp$/, "")
).replace(/\/$/, "");
const page = (title: string, body: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | Deadline Zero</title><style>
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#07102d;color:#eff4ff}body{max-width:760px;margin:0 auto;padding:48px 24px;line-height:1.6}h1{line-height:1.15}a{color:#9dc4ff}.tag{color:#99f6e4;font-weight:700}footer{margin-top:48px;color:#a7b3cf;font-size:.9rem}
</style></head><body><p class="tag">Deadline Zero</p><main>${body}</main><footer><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/health">Service status</a></footer></body></html>`;
app.get("/", async (_req, reply) =>
  reply
    .type("text/html; charset=utf-8")
    .send(
      page(
        "Adaptive planning for Alexa+",
        `<h1>Turn chaos into a plan that adapts.</h1><p>Deadline Zero turns spoken tasks into an actionable schedule and reshapes it when priorities change.</p><p>Use it with Alexa+ to capture tasks, see your next best action, and keep moving toward your deadlines.</p>`,
      ),
    ),
);
app.get("/privacy", async (_req, reply) =>
  reply
    .type("text/html; charset=utf-8")
    .send(
      page(
        "Privacy Policy",
        `<h1>Privacy Policy</h1><p>Deadline Zero stores the task details, scheduling preferences, plan history, and focus-session information needed to provide your planning experience.</p><p>Data is associated with the account authorized by your access token. It is used only to operate and improve your current planning experience. We do not sell personal data.</p><p>You can ask Deadline Zero to delete your data. The service clears active planning data and keeps only a minimal deletion marker needed to prevent stale requests from restoring it. Production backups follow the retention period configured by the service operator.</p><p>For privacy questions, contact the service operator through the support address published with this add-on.</p>`,
      ),
    ),
);
app.get("/terms", async (_req, reply) =>
  reply
    .type("text/html; charset=utf-8")
    .send(
      page(
        "Terms of Use",
        `<h1>Terms of Use</h1><p>Deadline Zero provides task-planning suggestions. You remain responsible for your deadlines, commitments, and decisions.</p><p>Use the service lawfully and do not attempt to disrupt it or access another person’s data. The service may change or be unavailable while it is being improved.</p><p>These terms are governed by the laws applicable to the service operator’s location, subject to mandatory consumer protections.</p>`,
      ),
    ),
);
const storeAssetNames = new Set([
  "icon-64x64.png",
  "icon-72x72.png",
  "icon-88x88.png",
  "icon-126x126.png",
  "icon-180x180.png",
  "icon-241x241.png",
  "carousel-600x900.png",
]);
app.get("/assets/store/:file", async (req, reply) => {
  const file = (req.params as { file: string }).file;
  if (!storeAssetNames.has(file))
    return reply.code(404).send({ error: "Not found" });
  try {
    return reply
      .header("cache-control", "public, max-age=31536000, immutable")
      .type("image/png")
      .send(readFileSync(resolve(process.cwd(), "assets", "store", file)));
  } catch {
    return reply
      .code(503)
      .send({ error: "Store assets are unavailable. Run npm run assets." });
  }
});
app.get("/health", async () => ({
  status: "ok",
  service: "deadline-zero",
  publicBaseUrl,
}));
app.get("/ready", async (_req, reply) => {
  if (pool) {
    try {
      await pool.query("SELECT 1");
    } catch {
      return reply.code(503).send({ status: "not-ready" });
    }
  }
  return { status: "ready", persistence: pool ? "postgres" : "process-memory" };
});
const authIssuer = env.OAUTH_ISSUER;
const authAuthorizationEndpoint = env.OAUTH_AUTHORIZATION_ENDPOINT;
const authTokenEndpoint = env.OAUTH_TOKEN_ENDPOINT;
const authAudience = env.OAUTH_AUDIENCE;
const authJwksUrl = env.OAUTH_JWKS_URL;
if (
  env.AUTH_MODE === "oauth" &&
  (!authIssuer ||
    !authAuthorizationEndpoint ||
    !authTokenEndpoint ||
    !authAudience ||
    !authJwksUrl)
)
  throw new Error(
    "AUTH_MODE=oauth requires OAUTH_ISSUER, OAUTH_AUTHORIZATION_ENDPOINT, OAUTH_TOKEN_ENDPOINT, OAUTH_AUDIENCE, and OAUTH_JWKS_URL.",
  );
const { createRemoteJWKSet, jwtVerify } = await import("jose");
const jwks = authJwksUrl ? createRemoteJWKSet(new URL(authJwksUrl)) : undefined;
const protectedResourceMetadata = async () => ({
  resource: env.MCP_BASE_URL,
  authorization_servers: authIssuer ? [authIssuer] : [],
  scopes_supported: ["tasks:read", "tasks:write"],
  bearer_methods_supported: ["header"],
});
app.get("/.well-known/oauth-protected-resource", protectedResourceMetadata);
app.get("/.well-known/oauth-protected-resource/mcp", protectedResourceMetadata);
app.get("/.well-known/oauth-authorization-server", async (_req, reply) => {
  if (!authIssuer || !authAuthorizationEndpoint || !authTokenEndpoint)
    return reply.code(503).send({ error: "oauth_provider_not_configured" });
  return {
    issuer: authIssuer,
    authorization_endpoint: authAuthorizationEndpoint,
    token_endpoint: authTokenEndpoint,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: ["tasks:read", "tasks:write"],
    token_endpoint_auth_methods_supported: ["none"],
  };
});

async function auth(
  req: { headers: Record<string, unknown> },
  reply: { code: (n: number) => { send: (x: unknown) => unknown } },
): Promise<string | undefined> {
  const value = String(req.headers.authorization ?? "");
  if (
    env.AUTH_MODE === "development" &&
    env.NODE_ENV !== "production" &&
    value === `Bearer ${env.DEV_BEARER_TOKEN}`
  )
    return "local-user";
  const bearer = value.startsWith("Bearer ") ? value.slice(7) : "";
  let expired = false;
  if (
    env.AUTH_MODE === "oauth" &&
    jwks &&
    authIssuer &&
    authAudience &&
    bearer
  ) {
    try {
      const verified = await jwtVerify(bearer, jwks, {
        issuer: authIssuer,
        audience: authAudience,
      });
      const scope = String(verified.payload.scope ?? "").split(" ");
      if (
        scope.includes("tasks:read") &&
        scope.includes("tasks:write") &&
        typeof verified.payload.sub === "string" &&
        verified.payload.sub.length > 0 &&
        verified.payload.sub.length <= 255
      )
        return verified.payload.sub;
    } catch (error) {
      /* Keep token validation details private. */
      expired =
        error instanceof Error &&
        "code" in error &&
        error.code === "ERR_JWT_EXPIRED";
    }
  }
  reply.code(401).send({
    error: {
      code: expired ? "AUTH_EXPIRED" : "AUTH_REQUIRED",
      message: expired
        ? "Your account link has expired."
        : "Link an account before accessing your plan.",
      recoverable: true,
      nextAction: expired
        ? "Reconnect your account, then try again."
        : "Complete Alexa+ account linking, then try again.",
    },
  });
  return undefined;
}

const tools = [
  {
    name: "capture_task",
    description:
      "Capture a task the customer mentioned in conversation. Use when they state something to do, with any known due date and time estimate. Does not create a schedule; returns a concise confirmation and any missing-information warnings.",
    inputSchema: {
      title: z.string().describe("Short task name in the customer's words."),
      description: z
        .string()
        .optional()
        .describe("Brief useful context, not a transcript."),
      notes: z
        .string()
        .max(1000)
        .optional()
        .describe("Optional task-specific notes."),
      category: z
        .string()
        .max(80)
        .optional()
        .describe("Optional subject or task category."),
      deadline: z
        .string()
        .datetime({ offset: true })
        .optional()
        .describe("Hard completion deadline as ISO 8601 with offset."),
      earliestStart: z
        .string()
        .datetime({ offset: true })
        .optional()
        .describe("Do not schedule before this ISO 8601 time."),
      latestStart: z
        .string()
        .datetime({ offset: true })
        .optional()
        .describe("Do not start this task after this ISO 8601 time."),
      estimatedDurationMinutes: z
        .number()
        .int()
        .min(5)
        .max(1440)
        .optional()
        .describe(
          "Best estimate in minutes; if unknown, omit and ask the customer.",
        ),
      priority: z
        .enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"])
        .optional()
        .describe("Relative importance; defaults to MEDIUM."),
      flexibility: z
        .enum(["FIXED", "FLEXIBLE", "OPTIONAL"])
        .optional()
        .describe("Whether the work can move; defaults to FLEXIBLE."),
      dependencies: z
        .array(z.string().uuid())
        .optional()
        .describe("IDs of tasks that must be finished first."),
    },
  },
  {
    name: "get_current_plan",
    description:
      "Show the customer’s current schedule, unfinished tasks, deadline risks, and next action. Use when they ask what is planned or what remains.",
    inputSchema: {},
  },
  {
    name: "create_plan",
    description:
      "Build an executable schedule from saved tasks, respecting deadlines and unavailable intervals. Use when the customer asks to plan a period. Returns a voice-friendly summary, schedule blocks, assumptions, and deadline risk.",
    inputSchema: {
      windowStart: z
        .string()
        .datetime({ offset: true })
        .describe("Start of the requested planning window as ISO 8601."),
      windowEnd: z
        .string()
        .datetime({ offset: true })
        .describe("End of the requested planning window as ISO 8601."),
    },
  },
  {
    name: "replan",
    description:
      "Adapt the existing plan after the customer reports a delay, new unavailable time, changed deadline, or other real-world change. This updates the actual plan and explains what moved.",
    inputSchema: {
      reason: z
        .string()
        .min(1)
        .max(300)
        .describe(
          "Brief reason for the real change, such as a delay or new commitment.",
        ),
      unavailableStart: z
        .string()
        .datetime({ offset: true })
        .optional()
        .describe("Beginning of new unavailable time, ISO 8601."),
      unavailableEnd: z
        .string()
        .datetime({ offset: true })
        .optional()
        .describe("End of new unavailable time, ISO 8601."),
      windowHours: z
        .number()
        .int()
        .min(1)
        .max(168)
        .optional()
        .describe("Optional number of hours to schedule forward."),
    },
  },
  {
    name: "complete_task",
    description:
      "Mark a task as finished when the customer says they completed it, then refresh the plan and suggest the next action.",
    inputSchema: {
      taskId: z.string().uuid().describe("ID of the task being completed."),
    },
  },
  {
    name: "update_task",
    description:
      "Apply a partial correction to a saved task when the customer changes its title, deadline, estimate, priority, flexibility, or status. Unmentioned fields remain unchanged. Use simulate_change for hypothetical changes.",
    inputSchema: {
      taskId: z.string().uuid().describe("ID of the saved task to correct."),
      patch: z
        .record(z.unknown())
        .describe(
          "Only the properties the customer changed; leave other task fields out.",
        ),
    },
  },
  {
    name: "get_next_action",
    description:
      "Recommend exactly one useful thing to do next based on the current time and schedule. Use when the customer asks what to do now.",
    inputSchema: {},
  },
  {
    name: "simulate_change",
    description:
      "Explore a hypothetical choice such as skipping a task without changing saved tasks or the current plan. Returns projected risk and a lower-risk recommendation.",
    inputSchema: {
      changeType: z
        .enum(["skip_task"])
        .describe(
          "Hypothetical operation. Simulation never changes the saved plan.",
        ),
      taskId: z.string().uuid().describe("Task to hypothetically skip."),
    },
  },
  {
    name: "get_progress",
    description:
      "Summarize task completion and deadline risk for a quick progress check.",
    inputSchema: {},
  },
  {
    name: "start_focus_session",
    description:
      "Start a focused work session for a saved task when the customer is ready to begin.",
    inputSchema: {
      taskId: z
        .string()
        .uuid()
        .describe("ID of the task to begin focusing on."),
    },
  },
  {
    name: "end_focus_session",
    description:
      "End the active focus session and record how many minutes were completed.",
    inputSchema: {
      minutesCompleted: z
        .number()
        .int()
        .min(1)
        .max(1440)
        .describe("Minutes of focused work actually completed."),
    },
  },
  {
    name: "get_task",
    description:
      "Retrieve one saved task by its ID when another tool or conversation has identified it.",
    inputSchema: {
      taskId: z.string().uuid().describe("ID of the task to retrieve."),
    },
  },
  {
    name: "delete_my_data",
    description:
      "Erase the linked customer's Deadline Zero tasks, availability, plans, and progress. Use only after the customer clearly asks to delete their Deadline Zero data and confirms the deletion. This does not unlink the external Alexa account.",
    inputSchema: {},
  },
];

function createMcp() {
  const server = new McpServer({ name: "deadline-zero", version: "0.1.0" });
  for (const t of tools)
    server.registerTool(
      t.name,
      {
        description: t.description,
        inputSchema: t.inputSchema,
        outputSchema: z.object({}).passthrough(),
        _meta: {
          ui: {
            resourceUri: "ui://deadline-zero/plan.html",
            visibility: ["model", "app"],
          },
        },
      },
      async (input: unknown) => {
        const started = performance.now();
        const identity = server as unknown as {
          _userId?: string;
          _requestId?: string;
          _requestKey?: string;
        };
        try {
          const user = identity._userId ?? "local-user";
          const state = await store.get(user),
            now = new Date();
          const cacheKey = identity._requestKey
            ? `${t.name}:${identity._requestKey}`
            : undefined;
          const cached = cacheKey ? state.requestCache?.[cacheKey] : undefined;
          if (cached && Date.parse(cached.expiresAt) > now.getTime()) {
            app.log.info({
              requestId: identity._requestId,
              event: "mcp_tool_replayed",
              tool: t.name,
              outcome: "success",
            });
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(cached.response),
                },
              ],
              structuredContent: cached.response,
            };
          }
          let mutated = false;
          let result: Record<string, unknown>;
          switch (t.name) {
            case "capture_task": {
              if (
                !(input as { estimatedDurationMinutes?: number })
                  .estimatedDurationMinutes
              )
                throw new Error(
                  "Task details are invalid: How long do you expect this task to take?",
                );
              const parsed = TaskInput.safeParse(input);
              if (!parsed.success)
                throw new Error(
                  `Task details are invalid: ${parsed.error.issues[0]?.message ?? "Check the required fields."}`,
                );
              if (state.tasks.length >= 500)
                throw new Error(
                  "Task details are invalid: Your task list is full. Complete or delete existing tasks first.",
                );
              const task = newTask(parsed.data);
              state.tasks.push(task);
              mutated = true;
              result = {
                task: publicTask(task),
                confirmationSummary: `Saved “${task.title}”${task.deadline ? ` for ${new Date(task.deadline).toLocaleString()}` : ""}.`,
                warnings:
                  task.priority === "MEDIUM"
                    ? ["No priority was provided; using medium."]
                    : [],
              };
              break;
            }
            case "get_current_plan":
              result = {
                currentPlan: state.plan,
                incompleteTasks: state.tasks
                  .filter((x) =>
                    ["TODO", "IN_PROGRESS", "BLOCKED"].includes(x.status),
                  )
                  .map(publicTask),
                atRiskTasks: state.plan?.warnings ?? [],
                nextAction: actionFor(state, now),
              };
              break;
            case "create_plan": {
              const args = input as { windowStart: string; windowEnd: string };
              state.plan = createPlan(
                state,
                args.windowStart,
                args.windowEnd,
                now,
              );
              mutated = true;
              result = {
                schedule: state.plan,
                reasoningSummary: state.plan.reasoningSummary,
                warnings: state.plan.warnings,
                riskLevel: state.plan.riskLevel,
              };
              break;
            }
            case "replan": {
              const a = input as {
                reason: string;
                unavailableStart?: string;
                unavailableEnd?: string;
                windowHours?: number;
              };
              if (a.unavailableStart && a.unavailableEnd)
                state.availability.push({
                  start: a.unavailableStart,
                  end: a.unavailableEnd,
                  label: "Customer unavailable",
                });
              result = replan(state, a.reason, now, a.windowHours);
              mutated = true;
              break;
            }
            case "complete_task": {
              const task = state.tasks.find(
                (x) => x.id === (input as { taskId: string }).taskId,
              );
              if (!task)
                throw new Error(
                  "Task not found. Ask for its name or capture it first.",
                );
              task.status = "COMPLETED";
              task.remainingDurationMinutes = 0;
              task.completedAt = now.toISOString();
              task.updatedAt = now.toISOString();
              if (state.plan) replan(state, `Completed ${task.title}`, now);
              mutated = true;
              result = {
                completedTask: publicTask(task),
                updatedPlan: state.plan,
                nextAction: actionFor(state, now),
              };
              break;
            }
            case "update_task": {
              const a = input as { taskId: string; patch: unknown },
                task = state.tasks.find((x) => x.id === a.taskId);
              if (!task)
                throw new Error(
                  "Task not found. Ask for its name or capture it first.",
                );
              const patch = TaskPatch.parse(a.patch);
              const consumed =
                task.estimatedDurationMinutes - task.remainingDurationMinutes;
              Object.assign(task, patch);
              if (patch.deadline === null) delete task.deadline;
              if (patch.earliestStart === null) delete task.earliestStart;
              if (patch.latestStart === null) delete task.latestStart;
              if (patch.estimatedDurationMinutes !== undefined)
                task.remainingDurationMinutes =
                  task.status === "COMPLETED"
                    ? 0
                    : Math.max(0, patch.estimatedDurationMinutes - consumed);
              if (patch.status === "COMPLETED") {
                task.remainingDurationMinutes = 0;
                task.completedAt = now.toISOString();
              } else if (patch.status && task.completedAt) {
                task.remainingDurationMinutes = task.estimatedDurationMinutes;
                delete task.completedAt;
              }
              task.updatedAt = now.toISOString();
              if (state.plan) replan(state, `Updated ${task.title}`, now);
              mutated = true;
              result = {
                task: publicTask(task),
                updatedPlan: state.plan,
                confirmationSummary: "Updated only the details you changed.",
              };
              break;
            }
            case "get_next_action":
              result = actionFor(state, now);
              break;
            case "simulate_change": {
              const a = input as { taskId: string };
              result = simulateSkip(state, a.taskId, now);
              break;
            }
            case "get_progress": {
              const total = state.tasks.length,
                complete = state.tasks.filter(
                  (x) => x.status === "COMPLETED",
                ).length;
              result = {
                completionPercentage: total
                  ? Math.round((complete / total) * 100)
                  : 0,
                completedCount: complete,
                remainingCount: total - complete,
                deadlineRisk: state.plan?.riskLevel ?? "UNKNOWN",
              };
              break;
            }
            case "delete_my_data": {
              await store.delete(user, state.revision);
              result = {
                deleted: true,
                confirmationSummary:
                  "Your Deadline Zero tasks, plans, availability, and progress were deleted.",
              };
              break;
            }
            case "start_focus_session": {
              const a = input as { taskId: string },
                task = state.tasks.find((x) => x.id === a.taskId);
              if (!task || !["TODO", "IN_PROGRESS"].includes(task.status))
                throw new Error("That task is not available to start.");
              state.focusSession = {
                taskId: task.id,
                startedAt: now.toISOString(),
              };
              task.status = "IN_PROGRESS";
              mutated = true;
              result = {
                started: true,
                task: publicTask(task),
                startedAt: now.toISOString(),
              };
              break;
            }
            case "end_focus_session": {
              if (!state.focusSession)
                throw new Error(
                  "There is no active focus session. Start a task first.",
                );
              const task = state.tasks.find(
                (x) => x.id === state.focusSession!.taskId,
              )!;
              task.remainingDurationMinutes = Math.max(
                0,
                task.remainingDurationMinutes -
                  (input as { minutesCompleted: number }).minutesCompleted,
              );
              task.status =
                task.remainingDurationMinutes === 0 ? "COMPLETED" : "TODO";
              if (task.status === "COMPLETED")
                task.completedAt = now.toISOString();
              delete state.focusSession;
              if (state.plan) replan(state, "Focus session ended", now);
              mutated = true;
              result = {
                task: publicTask(task),
                remainingMinutes: task.remainingDurationMinutes,
              };
              break;
            }
            default: {
              const task = state.tasks.find(
                (x) => x.id === (input as { taskId: string }).taskId,
              );
              if (!task) throw new Error("Task not found.");
              result = { task: publicTask(task) };
            }
          }
          if (mutated) {
            const nextCache = Object.fromEntries(
              Object.entries(state.requestCache ?? {}).filter(
                ([, entry]) => Date.parse(entry.expiresAt) > now.getTime(),
              ),
            );
            if (cacheKey)
              nextCache[cacheKey] = {
                expiresAt: new Date(now.getTime() + 10 * 60_000).toISOString(),
                response: result,
              };
            state.requestCache = Object.fromEntries(
              Object.entries(nextCache).slice(-100),
            );
            await store.put(user, state);
          }
          app.log.info({
            requestId: identity._requestId,
            event: "mcp_tool",
            tool: t.name,
            durationMs: Math.round(performance.now() - started),
            outcome: "success",
          });
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result) }],
            structuredContent: result,
          };
        } catch (err) {
          const rawMessage =
            err instanceof Error
              ? err.message
              : "The request could not be completed.";
          const validationError = err instanceof z.ZodError;
          const notFound = rawMessage.startsWith("Task not found");
          const missingEstimate = rawMessage.startsWith(
            "Task details are invalid: How long",
          );
          const infeasible = rawMessage.startsWith("Planning window");
          const concurrencyError = err instanceof ConcurrentUpdateError;
          const usableError =
            validationError ||
            concurrencyError ||
            rawMessage.startsWith("Task details are invalid") ||
            notFound ||
            infeasible ||
            rawMessage.startsWith("There is no active focus session") ||
            rawMessage.startsWith("That task is not available");
          const message = usableError
            ? rawMessage
            : "I couldn’t access your planning data just now.";
          const code = validationError
            ? "INVALID_INPUT"
            : concurrencyError
              ? "CONCURRENT_UPDATE"
              : notFound
                ? "TASK_NOT_FOUND"
                : infeasible
                  ? "PLAN_INFEASIBLE"
                  : usableError
                    ? "INVALID_INPUT"
                    : "SERVICE_UNAVAILABLE";
          app.log.warn({
            requestId: identity._requestId,
            event: "mcp_tool",
            tool: t.name,
            durationMs: Math.round(performance.now() - started),
            outcome: "error",
            errorCode: code,
          });
          const result = {
            error: {
              code,
              message,
              recoverable: true,
              nextAction: missingEstimate
                ? "Ask how long the task will take, then save it."
                : concurrencyError
                  ? "The plan changed in another request. Refresh the plan, then retry this change."
                  : notFound
                    ? "Ask which task they mean or capture it first."
                    : infeasible
                      ? "Choose a later planning window or free more time."
                      : validationError
                        ? "Check the task details and try again."
                        : "Try again shortly. If the issue continues, reconnect your account.",
            },
          };
          return {
            isError: true,
            content: [{ type: "text" as const, text: JSON.stringify(result) }],
            structuredContent: result,
          };
        }
      },
    );
  server.resource(
    "deadline-zero-app",
    "ui://deadline-zero/plan.html",
    async (uri) => ({
      contents: [
        { uri: uri.href, mimeType: "text/html;profile=mcp-app", text: appHtml },
      ],
    }),
  );
  return server;
}

const appHtml = (() => {
  try {
    return readFileSync(
      resolve(process.cwd(), "apps/mcp-app/build/index.html"),
      "utf8",
    );
  } catch {
    return "<!doctype html><html><body><main><h1>Deadline Zero</h1><p>Build the MCP App with npm run build:ui.</p></main></body></html>";
  }
})();

app.post("/mcp", async (req, reply) => {
  const user = await auth(req, reply);
  if (!user) return;
  const body = req.body as {
    method?: string;
    id?: string | number | null;
    params?: unknown;
    jsonrpc?: string;
  };
  if (!body || body.jsonrpc !== "2.0" || typeof body.method !== "string")
    return reply.code(400).send({
      jsonrpc: "2.0",
      id: body?.id ?? null,
      error: { code: -32600, message: "Invalid JSON-RPC request." },
    });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  } as unknown as ConstructorParameters<
    typeof StreamableHTTPServerTransport
  >[0]);
  const server = createMcp();
  const invocation = server as unknown as {
    _userId?: string;
    _requestId?: string;
    _requestKey?: string;
  };
  invocation._userId = user;
  invocation._requestId = req.id;
  const requestKey = req.headers["idempotency-key"];
  const requestKeyValue =
    typeof requestKey === "string" && requestKey.length <= 128
      ? requestKey
      : typeof body.id === "string" || typeof body.id === "number"
        ? String(body.id)
        : undefined;
  if (requestKeyValue) invocation._requestKey = requestKeyValue;
  await server.connect(transport as unknown as Transport);
  reply.raw.on("close", () => {
    void transport.close();
    void server.close();
  });
  // Fastify's Node adapter and the MCP SDK declarations expose slightly different request aliases.
  await transport.handleRequest(
    req.raw as unknown as IncomingMessage,
    reply.raw,
    body,
  );
});
app.get("/mcp", async (req, reply) => {
  if (!(await auth(req, reply))) return;
  return reply
    .code(405)
    .header("allow", "POST, DELETE")
    .send({ error: "This endpoint supports Streamable HTTP POST requests." });
});
app.delete("/mcp", async (req, reply) => {
  if (!(await auth(req, reply))) return;
  return reply
    .code(405)
    .header("allow", "POST")
    .send({ error: "No session is established in stateless mode." });
});

const origins = new Set(env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()));
app.addHook("onRequest", async (req, reply) => {
  reply.header("x-request-id", req.id);
  const origin = req.headers.origin;
  if (origin && origins.has(origin))
    reply
      .header("access-control-allow-origin", origin)
      .header("vary", "Origin")
      .header(
        "access-control-allow-headers",
        "authorization,content-type,mcp-session-id,last-event-id,idempotency-key",
      )
      .header("access-control-allow-methods", "GET,POST,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return reply.code(204).send();
});
app.setErrorHandler(
  (error: Error & { statusCode?: number; code?: string }, _req, reply) => {
    app.log.error({ event: "http_error", code: error.code });
    return reply
      .code(error.statusCode && error.statusCode < 500 ? error.statusCode : 500)
      .send({
        error: {
          code: "REQUEST_FAILED",
          message:
            error.statusCode && error.statusCode < 500
              ? error.message
              : "The service could not complete that request.",
          recoverable: true,
          nextAction:
            "Try again shortly. If the issue continues, contact support.",
        },
      });
  },
);
app.addHook("onClose", async () => {
  await pool?.end();
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void app.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  });
}
await app.listen({ host: env.HOST, port: env.PORT });
app.log.info({
  event: "server_started",
  port: env.PORT,
  authentication: env.AUTH_MODE,
  persistence: pool ? "postgres" : "process-memory",
});
