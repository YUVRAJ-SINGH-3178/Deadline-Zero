# Hackathon recording and submission

This document is for the **Build, Ship, Shape: Amazon Developer Hackathon** Alexa+ track. It describes the local simulated-experience path permitted by the event FAQ, not an Alexa+ certification or add-on-store launch.

## Run the demo

1. Run `Copy-Item .env.example .env` once, then `npm install` and `npm run dev`.
2. Open `http://localhost:3000/demo` in a desktop browser.
3. Enter `local-deadline-zero-token` or your `DEV_BEARER_TOKEN` value and click **Connect**.
4. Confirm the page shows protocol `2025-11-25` and `13 MCP tools available`.
5. Record the guided actions in order: capture demo tasks and make a plan, add an interruption and replan, preview skipping a task, complete work and show progress.

The browser page sends `initialize`, `tools/list`, and `tools/call` to the actual local Streamable HTTP endpoint. Its trace panel makes the MCP interaction visible in the recording.

## Video checklist

- Keep the video under three minutes.
- Start with the label **Deadline Zero — Local Alexa+ MCP Simulation**.
- Show the project running in the browser, not slides alone.
- Show the successful connection, task capture, plan, replan, what-if preview, and completion/progress flow.
- Briefly show the trace panel with real MCP request names.
- End with the schedule and the statement that the planner is deterministic and adaptive.
- Upload the finished video publicly to YouTube or Vimeo. Do not use copyrighted music, stock footage, trademarks, or an Alexa+ certification claim.

Suggested runtime: 0:00–0:15 problem; 0:15–0:45 connect and capture; 0:45–1:15 create plan; 1:15–1:40 replan; 1:40–2:00 what-if; 2:00–2:20 completion/progress; 2:20–2:45 MCP trace and architecture; 2:45–2:55 close.

## Devpost checklist

- Select the Alexa+ primary track.
- Use the public GitHub repository URL and retain the visible `LICENSE` file.
- Paste the project story, Build With tags, image captions, and public video URL.
- Submit truthful feedback. State that the project uses the open MCP SDK and Streamable HTTP; do not claim access to gated Alexa+ developer tools or device testing.
- Keep the repository and demo available free of charge until judging ends.

## Truthful feedback draft

**Tools used:** Node.js, TypeScript, the Model Context Protocol TypeScript SDK, Streamable HTTP, MCP Apps SDK, Fastify, PostgreSQL, and Docker.

**What worked well:** The MCP TypeScript SDK made it possible to expose focused tools and structured results over Streamable HTTP. MCP's tool schemas encouraged clear, validated task-planning operations. The local browser simulator made it straightforward to verify `initialize`, tool discovery, and real tool calls together.

**What needs work:** The Alexa+ add-on developer tools are preview-only for select partners, so we could not test the same server in the official Alexa+ console or web simulator. A public, end-to-end MCP client trace and a hackathon-accessible simulator would make it easier to validate tool selection, visual rendering, and conversational recovery.

**Onboarding:** The open MCP documentation and SDK were sufficient for a local working server. The gated Alexa+ tooling prevented direct onboarding validation.

**Would we build with it again?** Yes. MCP provided a clear contract for a stateful planning service, while a local simulation allowed us to demonstrate the user experience without pretending to have preview-only access.
