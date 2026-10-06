# MCP integration

The server uses `@modelcontextprotocol/sdk` and Streamable HTTP at `POST /mcp`. Initialize and tool calls use JSON-RPC 2.0 through the SDK transport. It supports `tools/list`, `tools/call`, standard initialization, and a `ui://deadline-zero/plan.html` HTML resource.

Successful tool results include concise `structuredContent` and text `content`. Failures return `isError` and an error object with stable code, message, recoverability, and next action. Requests are bounded to 256 KiB and rate-limited.

Authentication: local development uses a fixed bearer token only when `NODE_ENV` is not production. Production startup is blocked in that mode. With `AUTH_MODE=oauth`, access tokens are verified as JWTs against the configured trusted issuer/JWKS and audience, including `tasks:read` and `tasks:write` scopes. Authorization-code/PKCE issuance and account consent are provided by the registered external authorization server; do not expose the endpoint until Alexa account linking is configured.

Task, plan, and focus mutations cache their response by authenticated subject, tool name, and MCP request ID for ten minutes (bounded to the 100 most recent entries in user state). A retry with the same ID replays the previous result instead of repeating task creation or focus-session effects. Data deletion is safe to repeat. PostgreSQL state writes use revision checks; stale concurrent changes return `CONCURRENT_UPDATE` for a refresh-and-retry recovery.
