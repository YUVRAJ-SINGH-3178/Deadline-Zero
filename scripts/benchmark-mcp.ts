import { spawn } from "node:child_process";
import { randomInt, randomUUID } from "node:crypto";

const port = randomInt(31000, 47000),
  base = `http://127.0.0.1:${port}`,
  token = randomUUID() + randomUUID();
const server = spawn(process.execPath, ["dist/src/server.js"], {
  env: {
    ...process.env,
    NODE_ENV: "test",
    AUTH_MODE: "development",
    DEV_BEARER_TOKEN: token,
    HOST: "127.0.0.1",
    PORT: String(port),
    ALLOWED_ORIGINS: base,
  },
  stdio: "ignore",
});
let id = 0;
async function request(method: string, params?: unknown) {
  const started = performance.now();
  const response = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
      "mcp-protocol-version": "2025-03-26",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: ++id,
      method,
      ...(params === undefined ? {} : { params }),
    }),
  });
  const text = await response.text();
  const payload = response.headers
    .get("content-type")
    ?.includes("text/event-stream")
    ? (text
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .findLast(Boolean) ?? "{}")
    : text;
  const body = JSON.parse(payload) as {
    result?: { structuredContent?: Record<string, unknown> };
    error?: unknown;
  };
  if (!response.ok || body.error)
    throw new Error(
      `${method} failed: ${JSON.stringify(body.error ?? response.status)}`,
    );
  return { body: body.result, durationMs: performance.now() - started };
}

try {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${base}/health`)).ok) break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  await request("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "deadline-zero-benchmark", version: "1.0.0" },
  });
  const measurements: Record<string, number> = {};
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const measured = await request("tools/call", { name, arguments: args });
    measurements[name] = measured.durationMs;
    return measured.body?.structuredContent ?? {};
  };
  const captured = await call("capture_task", {
    title: "Benchmark task",
    estimatedDurationMinutes: 45,
    priority: "HIGH",
  });
  const taskId = (captured.task as { id: string }).id;
  const start = new Date(Date.now() - 60_000).toISOString(),
    end = new Date(Date.now() + 3_600_000).toISOString();
  await call("create_plan", { windowStart: start, windowEnd: end });
  await call("get_current_plan");
  await call("get_next_action");
  await call("get_progress");
  await call("update_task", { taskId, patch: { deadline: end } });
  await call("simulate_change", { changeType: "skip_task", taskId });
  await call("start_focus_session", { taskId });
  await call("end_focus_session", { minutesCompleted: 5 });
  await call("complete_task", { taskId });
  await call("replan", { reason: "benchmark interruption" });
  await call("get_task", { taskId });
  await call("delete_my_data");
  const values = Object.values(measurements).sort((a, b) => a - b);
  console.log(
    JSON.stringify(
      {
        benchmark:
          "local MCP tool-call round trip, process-memory store, loopback HTTP",
        tools: measurements,
        p50Ms: +values[Math.floor(values.length * 0.5)]!.toFixed(2),
        p95Ms: +values[Math.floor(values.length * 0.95)]!.toFixed(2),
        maxMs: +values.at(-1)!.toFixed(2),
        targetMs: 500,
        note: "One invocation per tool; excludes Alexa network path, remote hosting, OAuth provider, and PostgreSQL.",
      },
      null,
      2,
    ),
  );
} finally {
  server.kill();
}
