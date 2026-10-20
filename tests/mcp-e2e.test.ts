import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { randomInt } from "node:crypto";

const port = randomInt(18000, 30000);
const base = `http://127.0.0.1:${port}`;
const token = "test-token-that-is-long-enough";
let child: ChildProcess;
let seq = 0;
let childOutput = "";
async function rpc(method: string, params?: unknown, requestId?: number) {
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
      id: requestId ?? ++seq,
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
  return {
    status: response.status,
    body: JSON.parse(payload) as {
      result?: {
        tools?: unknown[];
        structuredContent?: Record<string, unknown>;
        content?: { text?: string }[];
      };
      error?: { message: string };
    },
  };
}
beforeAll(async () => {
  child = spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "test",
      AUTH_MODE: "development",
      DEV_BEARER_TOKEN: token,
      HOST: "127.0.0.1",
      PORT: String(port),
      ALLOWED_ORIGINS: base,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (chunk) => {
    childOutput += String(chunk);
  });
  child.stderr?.on("data", (chunk) => {
    childOutput += String(chunk);
  });
  const until = Date.now() + 15_000;
  while (Date.now() < until) {
    try {
      if ((await fetch(`${base}/health`)).ok) return;
    } catch {
      /* Server is still starting. */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(
    `MCP server did not become healthy within 15 seconds. ${childOutput}`,
  );
}, 20_000);
afterAll(() => {
  child?.kill();
});

describe("MCP Streamable HTTP end-to-end", () => {
  it("serves public store listing pages and valid PNG media without authentication", async () => {
    const [home, privacy, terms, icon, carousel] = await Promise.all([
      fetch(`${base}/`),
      fetch(`${base}/privacy`),
      fetch(`${base}/terms`),
      fetch(`${base}/assets/store/icon-64x64.png`),
      fetch(`${base}/assets/store/carousel-600x900.png`),
    ]);
    expect(home.status).toBe(200);
    expect(await home.text()).toContain("Turn chaos into a plan");
    expect(privacy.status).toBe(200);
    expect(await privacy.text()).toContain("Privacy Policy");
    expect(terms.status).toBe(200);
    expect(await terms.text()).toContain("Terms of Use");
    for (const image of [icon, carousel]) {
      expect(image.status).toBe(200);
      expect(image.headers.get("content-type")).toContain("image/png");
      expect(Buffer.from(await image.arrayBuffer()).subarray(0, 8)).toEqual(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      );
    }
  });
  it("initializes, lists useful tools, and supports task capture through a real MCP call", async () => {
    const init = await rpc("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "deadline-zero-test", version: "1.0.0" },
    });
    expect(init.status).toBe(200);
    expect(init.body.result).toBeDefined();
    const listed = await rpc("tools/list");
    expect(listed.status).toBe(200);
    expect(listed.body.result?.tools).toHaveLength(13);
    const declarations = listed.body.result?.tools as {
      name?: string;
      description?: string;
      inputSchema?: { type?: string; properties?: Record<string, unknown> };
    }[];
    expect(
      declarations.every((tool) =>
        Boolean(
          tool.name &&
          tool.description &&
          tool.inputSchema?.type === "object" &&
          tool.inputSchema.properties !== undefined,
        ),
      ),
    ).toBe(true);
    const task = {
      title: "Read chapter",
      estimatedDurationMinutes: 30,
      priority: "HIGH",
    };
    const captureParams = { name: "capture_task", arguments: task };
    const captureRequestId = 424242;
    const captured = await rpc("tools/call", captureParams, captureRequestId);
    const replay = await rpc("tools/call", captureParams, captureRequestId);
    const structured = captured.body.result?.structuredContent;
    expect(structured?.confirmationSummary).toContain("Read chapter");
    const taskId = (structured?.task as { id?: string })?.id;
    expect(taskId).toBeTruthy();
    expect(replay.body.result?.structuredContent).toEqual(structured);
    const call = async (name: string, args: Record<string, unknown> = {}) => {
      const response = await rpc("tools/call", { name, arguments: args });
      expect(response.status).toBe(200);
      expect(response.body.result?.structuredContent).toBeDefined();
      expect(response.body.result?.content?.[0]?.text?.length).toBeLessThan(
        8000,
      );
      return response.body.result!.structuredContent!;
    };
    const from = new Date(Date.now() - 60_000).toISOString(),
      to = new Date(Date.now() + 3_600_000).toISOString();
    await call("create_plan", { windowStart: from, windowEnd: to });
    await call("get_current_plan");
    await call("get_next_action");
    await call("get_progress");
    const updated = await call("update_task", {
      taskId,
      patch: { deadline: to },
    });
    expect((updated.task as { title: string; priority: string }).title).toBe(
      "Read chapter",
    );
    expect((updated.task as { priority: string }).priority).toBe("HIGH");
    await call("simulate_change", { changeType: "skip_task", taskId });
    await call("start_focus_session", { taskId });
    await call("end_focus_session", { minutesCompleted: 10 });
    await call("complete_task", { taskId });
    await call("replan", { reason: "integration test changed the day" });
    await call("get_task", { taskId });
    const deleted = await call("delete_my_data");
    expect(deleted.deleted).toBe(true);
    const invalid = await rpc("tools/call", {
      name: "capture_task",
      arguments: { title: "Missing estimate" },
    });
    expect(
      (invalid.body.result?.structuredContent?.error as { message: string })
        .message,
    ).toContain("How long do you expect this task to take?");
    expect(JSON.stringify(captured.body.result)).not.toContain(token);
  });
  it("rejects unauthenticated requests with 401 and does not expose task data", async () => {
    const response = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 99, method: "tools/list" }),
    });
    expect(response.status).toBe(401);
  });
});
