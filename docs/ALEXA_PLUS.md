# Alexa+ integration status

> **Hackathon note:** The Amazon Developer Hackathon permits a locally demonstrated self-hosted MCP server or browser-based simulated Alexa+ experience. The official Alexa+ add-on tooling remains select-partner preview access, so this document's production onboarding steps are not required for the hackathon submission. See [HACKATHON_READY.md](HACKATHON_READY.md).

Research checked against Amazon’s current official documentation (accessed 2026-10-07): [MCP QuickStart](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-quickstart.html), [design guide](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-design-guide.html), [functional requirements](https://developer.amazon.com/docs/alexaplus/add-ons/functional-requirements.html), [certification guidelines](https://developer.amazon.com/docs/alexaplus/add-ons/certification-guidelines.html), [display modes](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-display-modes.html), [tool/schema guide](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-tools-schema-data-design.html), [client lifecycle](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-client-lifecycle.html), [certification flow](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-certify.html).

Amazon’s QuickStart currently requires remote Streamable HTTP, MCP Apps for visuals, OAuth 2.1 authorization-code with PKCE S256 for account linking, resource metadata, and sub-500ms query response. Alexa’s client lifecycle page shows protocol version `2025-03-26`; the transport SDK negotiates initialization. Alexa AI CLI onboarding generates `addon-package/addon.json`; deploy refreshes the registered tools.

## Implemented locally

- Streamable HTTP via MCP SDK, initialize and tool protocol handling.
- Useful task and planning tool schemas with structured results.
- MCP Apps-compatible HTML resource and local health/readiness endpoints.
- OAuth discovery metadata route shape and JWT resource-server validation against a configured JWKS provider. Production refuses to start without issuer, authorization endpoint, token endpoint, audience, and JWKS URL.
- Local test path and onboarding documentation. The Alexa AI CLI add-on package has not been generated.

## Endpoint, tools, and app

- MCP URL: `POST https://YOUR_HOST/mcp` (the `.env.example` localhost URL is for local use only).
- Transport: MCP SDK Streamable HTTP, stateless request lifecycle, protocol initialization and standard `tools/list` / `tools/call`.
- Tools: `capture_task`, `get_current_plan`, `create_plan`, `replan`, `complete_task`, `update_task`, `get_next_action`, `simulate_change`, `get_progress`, `start_focus_session`, `end_focus_session`, `get_task`, and `delete_my_data`.
- Inputs are Zod-defined JSON schemas; results carry structured content and text, with recovery fields on tool errors.
- MCP App resource: `ui://deadline-zero/plan.html`, referenced from tool metadata. It uses inline display by default, provides an explicit fullscreen expansion control for longer plans, respects host locale/time zone updates, and keeps spoken text useful without a screen.

## Account linking

Set `AUTH_MODE=oauth`, `MCP_BASE_URL`, `OAUTH_ISSUER`, `OAUTH_AUTHORIZATION_ENDPOINT`, `OAUTH_TOKEN_ENDPOINT`, `OAUTH_AUDIENCE`, and `OAUTH_JWKS_URL`. The configured authorization server must implement OAuth 2.1 authorization-code with PKCE S256, registered Alexa redirect URIs, consent, and the advertised task scopes. This resource server validates JWT signature, issuer, audience, subject, and scopes. Local bearer mode is accepted only outside production and production startup rejects it.

## Onboarding, deployment, and testing

1. Install the official Alexa AI CLI and run `alexa-ai configure` using an Alexa developer account.
2. For a local server, expose an HTTPS tunnel (for example, cloudflared) and use that public endpoint; local `localhost` URLs are unreachable from Alexa+.
3. Run `alexa-ai new mcp --name "Deadline Zero" --locale en-US --mcp-server-url "https://YOUR_HOST/mcp"` after the real deployment and OAuth provider are configured.
4. Complete the generated `addon-package/addon.json` store listing, privacy/terms URLs, and required real media assets; validate and run `alexa-ai deploy` to the development stage.
5. Test with the Alexa+ web simulator. A physical-device test requires a supported device and developer access. Run the current certification checklist and submit with `alexa-ai submit` only after real simulator/device QA.

## Access and status

- **Implemented:** local MCP server, deterministic planner, structured schemas/results, signed-token validation adapter, MCP App resource, local protocol/e2e tests, and Alexa onboarding instructions.
- **Requires credentials/access:** approved OAuth provider configuration and Alexa+ builder preview access.
- **Requires manual developer-console action:** generate and complete the CLI add-on package, enter the privacy/compliance and media information, deploy, simulator/device test, and submit for certification.

## External actions still required

1. Set up an approved OAuth 2.1 authorization server and account-linking policy. The provider owns authorization-code/PKCE issuance; this MCP server validates signed JWT access tokens using the configured issuer, audience, JWKS, and required scopes. Configure Amazon’s registered redirect URI, scopes, and resource audience in the provider before production.
2. Obtain Alexa+ builder access and install/configure the official Alexa AI CLI.
3. Deploy this service at a public HTTPS URL with Postgres and valid production OAuth validation. Configure CORS, origin allowlist, secrets, TLS, monitoring, backups, and rate limits for that hosting environment.
4. Run `alexa-ai new mcp --name "Deadline Zero" --locale en-US --mcp-server-url "https://YOUR_HOST/mcp"`; finish the generated `addon-package/addon.json` listing and legally valid privacy/terms URLs and media assets.
5. Run `alexa-ai deploy`, test in the Alexa+ web simulator, capture genuine evidence, and submit only after meeting current certification requirements.

This repository has not been connected to Alexa+, deployed remotely, certified, or tested on a physical device. The local MCP implementation is not evidence of Amazon approval.
