# Deadline Zero

**Turn chaos into a plan that adapts.** Deadline Zero turns conversational task details into a practical schedule, then reshapes it when life changes.

This repository contains a deterministic planning service exposed over MCP Streamable HTTP, a screen-oriented plan view, Postgres persistence, and a local development mode. Alexa+ suits the experience because a person can describe a chaotic evening conversationally, then glance at a schedule or keep using voice alone.

For the Amazon Developer Hackathon, use the local browser simulator at `/demo`. It is a real MCP client that calls this server over Streamable HTTP using protocol `2025-11-25`; it is explicitly labeled as a local Alexa+ simulation.

## Hackathon Access & Evaluation Guide

This project is completely self-contained and requires no paid external APIs, LLM API keys, AWS credentials, or hardware devices to evaluate.

- **Simulator URL**: `http://localhost:3000/demo` (or `http://localhost:3000/demo?auto=true` for the automated walkthrough)
- **Development Bearer Token**: `local-deadline-zero-token`
- **MCP Endpoint**: `http://localhost:3000/mcp`
- **Quick Start**:
  ```powershell
  npm install
  npm run dev
  ```
  Open `http://localhost:3000/demo`, enter `local-deadline-zero-token`, and click **Connect**. You can test each MCP operation individually or click **▶ Start 2m 40s Recorded Walkthrough** for the full interactive demonstration.

## Alexa+ submission package

The repository now includes a zero-cost, source-controlled submission package:

- `addon-package/addon.json.template` with the store copy, three voice phrases, MCP endpoint declaration, privacy/terms URLs, and every required media slot.
- `assets/store/` with all six required PNG icon sizes and a 600×900 carousel image. Regenerate them with `npm run assets`.
- First-party public routes: `/`, `/privacy`, `/terms`, and `/assets/store/*`. They become valid HTTPS listing URLs after deployment.

Before using the manifest, replace every `YOUR_PUBLIC_HOST` value with the deployed HTTPS hostname. The Alexa AI CLI must generate the final package and authenticate using your Amazon developer account; see [ALEXA_PLUS.md](docs/ALEXA_PLUS.md).

## Run locally

Requires Node.js 22+ and npm. Set `DEV_BEARER_TOKEN` to a random value of at least 16 characters for Docker use.

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Open `http://localhost:3000/demo`, enter `local-deadline-zero-token` (or the value of `DEV_BEARER_TOKEN` in `.env`), then select **Connect**. The guided controls create a working, recordable demonstration using real `initialize`, `tools/list`, and `tools/call` requests.

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

For recording and Devpost submission, follow [HACKATHON_READY.md](docs/HACKATHON_READY.md).

Environment variable reference: [CONFIGURATION.md](docs/CONFIGURATION.md).
