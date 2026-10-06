# Deadline Zero

**Turn chaos into a plan that adapts.** Deadline Zero turns conversational task details into a practical schedule, then reshapes it when life changes.

This repository contains a deterministic planning service exposed over MCP Streamable HTTP, a screen-oriented plan view, Postgres persistence, and a local development mode. Alexa+ suits the experience because a person can describe a chaotic evening conversationally, then glance at a schedule or keep using voice alone. Account linking and publication still require external developer access; see [ALEXA_PLUS.md](docs/ALEXA_PLUS.md).

## Run locally

Requires Node.js 22+ and npm. Set `DEV_BEARER_TOKEN` to a random value of at least 16 characters for Docker use.

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

The local endpoint is `http://localhost:3000/mcp`. For a self-contained local flow, set `AUTH_MODE=development` and send `Authorization: Bearer local-deadline-zero-token`. This path is rejected in production.

For persistence, run `docker compose up --build`; the migration runs on the initial Postgres volume creation.

Run `npm run demo:seed` after starting Postgres to load the repeatable scenario for the authenticated development user.

## MCP tools

`capture_task`, `get_current_plan`, `create_plan`, `replan`, `complete_task`, `update_task`, `get_next_action`, `simulate_change`, `get_progress`, `start_focus_session`, `end_focus_session`, `get_task`, and `delete_my_data`.

Core operations use deterministic scheduling. No LLM or external calendar is needed. Mock calendar commitments are represented as unavailable intervals.

The planner respects deadline, priority, task dependencies, start windows, and unavailable intervals; what-if simulations do not change saved state. See [DEMO.md](docs/DEMO.md) for the demo flow and [PRIVACY.md](docs/PRIVACY.md) for stored data and deletion.

## Verify

```powershell
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
npm run bench
npm run bench:mcp
```

See [TESTING.md](docs/TESTING.md), [DEPLOYMENT.md](docs/DEPLOYMENT.md), and [FINAL_STATUS.md](docs/FINAL_STATUS.md) for actual readiness boundaries.

Environment variable reference: [CONFIGURATION.md](docs/CONFIGURATION.md).
