import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
describe("MCP contract artifacts", () => {
  it("declares Streamable HTTP transport, authentication configuration, and recovery response contract", () => {
    const source = readFileSync(
      new URL("../src/server.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain("StreamableHTTPServerTransport");
    expect(source).toContain("structuredContent");
    expect(source).toContain("AUTH_REQUIRED");
    expect(source).toContain('name: "simulate_change"');
    expect(source).toContain('name: "update_task"');
  });
});
