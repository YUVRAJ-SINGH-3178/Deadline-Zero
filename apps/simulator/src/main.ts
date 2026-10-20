import "./style.css";

type RpcResult = {
  result?: {
    structuredContent?: Record<string, unknown>;
    tools?: { name: string }[];
  };
  error?: { message?: string };
};
type Task = { id: string; title: string };

const root = document.querySelector<HTMLElement>("#app")!;
root.innerHTML = `
  <header><div class="eyebrow">LOCAL ALEXA+ MCP SIMULATION</div><h1>Deadline <i>Zero</i></h1><p>Turn chaos into a plan that adapts.</p></header>
  <section class="connect card"><div><h2>Connect to your local MCP server</h2><p>This browser page sends real <code>initialize</code>, <code>tools/list</code>, and <code>tools/call</code> requests over Streamable HTTP.</p></div><div class="fields"><label>MCP endpoint<input id="endpoint" value="/mcp" inputmode="url" /></label><label>Development bearer token<input id="token" type="password" placeholder="Paste DEV_BEARER_TOKEN from .env" /></label><button id="connect">Connect</button></div><p id="connection" class="status">Not connected</p></section>
  <section class="workspace"><div class="card controls"><h2>Demo controls</h2><p>Use the guided flow below to create an authentic, recordable MCP demonstration.</p><button id="seed" disabled>1. Capture demo tasks and make a plan</button><button id="replan" disabled>2. Add an interruption and replan</button><button id="simulate" disabled>3. Preview skipping a task</button><button id="complete" disabled>4. Complete work and show progress</button><button id="refresh" class="secondary" disabled>Refresh current plan</button></div><div class="card plan"><div class="plan-heading"><div><h2>Your adaptive plan</h2><p id="summary">Connect to begin.</p></div><span id="risk" class="risk">WAITING</span></div><ol id="schedule"><li class="empty">No plan yet.</li></ol></div></section>
  <section class="card trace"><div><h2>Live MCP trace</h2><p>Each entry below is a real request made by this page to the local server.</p></div><ol id="trace"></ol></section>
  <footer>Deadline Zero is an independent local simulation built for the Amazon Developer Hackathon. It is not the Alexa+ product or an Alexa certification claim.</footer>`;

const endpoint = document.querySelector<HTMLInputElement>("#endpoint")!;
const token = document.querySelector<HTMLInputElement>("#token")!;
const connect = document.querySelector<HTMLButtonElement>("#connect")!;
const status = document.querySelector<HTMLElement>("#connection")!;
const summary = document.querySelector<HTMLElement>("#summary")!;
const risk = document.querySelector<HTMLElement>("#risk")!;
const schedule = document.querySelector<HTMLOListElement>("#schedule")!;
const trace = document.querySelector<HTMLOListElement>("#trace")!;
const buttons = ["seed", "replan", "simulate", "complete", "refresh"].map(
  (id) => document.querySelector<HTMLButtonElement>(`#${id}`)!,
);
let requestId = 0;
let tasks: Task[] = [];
let connected = false;

function showTrace(method: string, detail: string, ok = true) {
  const entry = document.createElement("li");
  const name = document.createElement("strong");
  name.textContent = method;
  const text = document.createElement("span");
  text.textContent = detail;
  entry.className = ok ? "success" : "failure";
  entry.append(name, text);
  trace.prepend(entry);
}
async function rpc(method: string, params?: unknown): Promise<RpcResult> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "mcp-protocol-version": "2025-11-25",
  };
  if (token.value.trim())
    headers.authorization = `Bearer ${token.value.trim()}`;
  const response = await fetch(endpoint.value.trim() || "/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: ++requestId,
      method,
      ...(params === undefined ? {} : { params }),
    }),
  });
  const raw = await response.text();
  const payload = response.headers
    .get("content-type")
    ?.includes("text/event-stream")
    ? raw
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .findLast(Boolean) || "{}"
    : raw;
  const parsed = JSON.parse(payload) as RpcResult;
  const detail = response.ok
    ? "completed"
    : parsed.error?.message || `HTTP ${response.status}`;
  showTrace(method, detail, response.ok);
  if (!response.ok || parsed.error) throw new Error(detail);
  return parsed;
}
function resultData(result: RpcResult) {
  return result.result?.structuredContent ?? {};
}
function updatePlan(data: Record<string, unknown>) {
  const plan = (data.schedule ??
    data.updatedPlan ??
    data.currentPlan ??
    data.newPlan ??
    data.simulatedPlan) as
    | {
        blocks?: {
          taskId: string;
          title: string;
          start: string;
          end: string;
          durationMinutes: number;
        }[];
        riskLevel?: string;
        warnings?: string[];
      }
    | undefined;
  if (typeof data.confirmationSummary === "string")
    summary.textContent = data.confirmationSummary;
  if (typeof data.reasoningSummary === "string")
    summary.textContent = data.reasoningSummary;
  if (typeof data.impact === "string")
    summary.textContent = `Preview: ${data.impact}. Your saved plan is unchanged.`;
  if (typeof data.completionPercentage === "number")
    summary.textContent = `${data.completionPercentage}% complete — ${data.completedCount} finished and ${data.remainingCount} remaining.`;
  if (!plan) return;
  const level = plan.riskLevel ?? "LOW";
  risk.textContent = level;
  risk.className = `risk ${level.toLowerCase()}`;
  schedule.replaceChildren();
  for (const block of plan.blocks ?? []) {
    const item = document.createElement("li");
    const time = document.createElement("time");
    time.textContent = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(block.start));
    const work = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = block.title;
    const meta = document.createElement("span");
    meta.textContent = `${block.durationMinutes} minutes`;
    work.append(title, meta);
    item.append(time, work);
    schedule.append(item);
  }
  if (!plan.blocks?.length)
    schedule.innerHTML =
      '<li class="empty">The plan has no scheduled blocks yet.</li>';
  const warnings = plan.warnings ?? [];
  if (warnings.length)
    summary.textContent = `${summary.textContent} ${warnings[0]}`;
}
async function call(name: string, args: Record<string, unknown> = {}) {
  const result = await rpc("tools/call", { name, arguments: args });
  const data = resultData(result);
  updatePlan(data);
  return data;
}
async function connectServer() {
  try {
    status.textContent = "Connecting…";
    const initialized = await rpc("initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "deadline-zero-local-simulator", version: "1.0.0" },
    });
    const list = await rpc("tools/list");
    const count = list.result?.tools?.length ?? 0;
    connected = true;
    buttons.forEach((button) => (button.disabled = false));
    status.textContent = `Connected — protocol 2025-11-25, ${count} MCP tools available.`;
    status.className = "status ready";
    showTrace(
      "initialized",
      `server accepted protocol ${(initialized.result as { protocolVersion?: string } | undefined)?.protocolVersion ?? "2025-11-25"}`,
    );
  } catch (error) {
    status.textContent = `${error instanceof Error ? error.message : "Connection failed"}. Check the endpoint and token.`;
    status.className = "status error";
  }
}
async function seedDemo() {
  if (!connected) return;
  try {
    const now = Date.now();
    const specs = [
      ["Finish calculus problem set", 55, "CRITICAL", 3],
      ["Prepare project presentation", 45, "HIGH", 5],
      ["Read research chapter", 30, "MEDIUM", 7],
    ] as const;
    tasks = [];
    for (const [title, minutes, priority, deadlineHours] of specs) {
      const data = await call("capture_task", {
        title,
        estimatedDurationMinutes: minutes,
        priority,
        flexibility: "FLEXIBLE",
        deadline: new Date(now + deadlineHours * 3_600_000).toISOString(),
      });
      const task = data.task as Task | undefined;
      if (task) tasks.push(task);
    }
    const data = await call("create_plan", {
      windowStart: new Date(now).toISOString(),
      windowEnd: new Date(now + 8 * 3_600_000).toISOString(),
    });
    updatePlan(data);
  } catch (error) {
    summary.textContent =
      error instanceof Error
        ? error.message
        : "Could not create the demo plan.";
  }
}
async function replanDay() {
  try {
    const now = Date.now();
    const data = await call("replan", {
      reason: "A meeting just ran late",
      unavailableStart: new Date(now + 30 * 60_000).toISOString(),
      unavailableEnd: new Date(now + 75 * 60_000).toISOString(),
      windowHours: 8,
    });
    updatePlan(data);
  } catch (error) {
    summary.textContent =
      error instanceof Error ? error.message : "Could not replan.";
  }
}
connect.addEventListener("click", () => void connectServer());
document
  .querySelector("#seed")!
  .addEventListener("click", () => void seedDemo());
document
  .querySelector("#replan")!
  .addEventListener("click", () => void replanDay());
document.querySelector("#simulate")!.addEventListener(
  "click",
  () =>
    void (tasks[2]
      ? call("simulate_change", {
          changeType: "skip_task",
          taskId: tasks[2].id,
        }).catch((error: unknown) => {
          summary.textContent =
            error instanceof Error ? error.message : "Could not simulate.";
        })
      : undefined),
);
document.querySelector("#complete")!.addEventListener(
  "click",
  () =>
    void (tasks[0]
      ? call("complete_task", { taskId: tasks[0].id })
          .then(() => call("get_progress"))
          .catch((error: unknown) => {
            summary.textContent =
              error instanceof Error
                ? error.message
                : "Could not complete the task.";
          })
      : undefined),
);
document.querySelector("#refresh")!.addEventListener(
  "click",
  () =>
    void call("get_current_plan").catch((error: unknown) => {
      summary.textContent =
        error instanceof Error ? error.message : "Could not refresh the plan.";
    }),
);
