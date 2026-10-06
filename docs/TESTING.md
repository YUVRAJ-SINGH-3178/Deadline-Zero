# Testing

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run bench`, and `npm run bench:mcp` (the MCP benchmark follows a production build).

The planner tests cover deadline ordering, unavailable windows, infeasible work, prerequisite ordering, start-window constraints, immutable simulation, replan version history, and input validation. The live MCP contract test initializes a real server, lists and validates tool schemas, invokes every tool, checks partial updates and same-request replay, tests invalid input and authentication, and verifies the data-deletion tool. Full Alexa+ simulator tests require developer access; local endpoint instructions are in [DEMO_CHECKLIST.md](DEMO_CHECKLIST.md).

The planner benchmark runs 1,000 deterministic passes over 100 synthetic tasks. The MCP benchmark invokes every tool against a local server and reports per-tool loopback round-trip. Neither measures remote network, PostgreSQL, Echo rendering, or Alexa response latency. Sub-500 ms remote compliance must be measured after deployment.
