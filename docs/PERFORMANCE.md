# Performance results

Measured locally on 2026-10-07 after a production build. These are loopback/process-memory measurements, not remote Alexa+ certification evidence.

## MCP tool round-trip

One invocation of each tool through a real local Streamable HTTP server. Includes loopback HTTP, JSON-RPC/MCP handling, Zod validation, and in-memory state. Excludes remote network, OAuth provider/JWKS cold fetch, PostgreSQL, Alexa orchestration, and device rendering.

| Tool                | Round-trip |
| ------------------- | ---------: |
| capture_task        |   27.11 ms |
| create_plan         |   12.32 ms |
| get_current_plan    |    9.22 ms |
| get_next_action     |    7.54 ms |
| get_progress        |    7.14 ms |
| update_task         |   38.52 ms |
| simulate_change     |   10.13 ms |
| start_focus_session |   16.65 ms |
| end_focus_session   |   12.47 ms |
| complete_task       |   10.20 ms |
| replan              |    9.04 ms |
| get_task            |    8.66 ms |
| delete_my_data      |    8.32 ms |

Overall p50 was 10.13 ms; p95 and max were 38.52 ms for this one-pass sample. A wider run against the target region and database is still required to verify Amazon’s <500 ms requirement under load.

## Planner compute

1,000 plan generations with 100 tasks per run: p50 3.88 ms, p95 7.62 ms, max 60.58 ms. These values include dependency ordering and schedule generation but no database access.

## App payload

The single-file MCP App build was 314,078 bytes raw and 67,453 bytes gzip. Alexa host delivery may apply its own transport compression; no device rendering time was measured.

Reproduce with `npm run build`, `npm run bench`, and `npm run bench:mcp`.
