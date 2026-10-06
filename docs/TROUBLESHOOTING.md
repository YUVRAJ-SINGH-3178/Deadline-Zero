# Troubleshooting

- **`npm` registry/cache permission error:** use an approved npm environment with access to the npm registry and a writable npm cache, then run `npm install`.
- **401 from `/mcp`:** local development requires `Authorization: Bearer <DEV_BEARER_TOKEN>`. Production must use the separately configured trusted OAuth resource-server adapter; this repository blocks local auth in production.
- **`/ready` returns 503:** verify PostgreSQL is reachable and the migration `db/migrations/001_user_state.sql` has run.
- **No task schedule:** provide a valid ISO 8601 start/end window; check task deadlines, dependencies, and unavailable intervals.
- **Alexa+ cannot reach localhost:** expose an HTTPS endpoint with a suitable tunnel during development; the Alexa client requires a remotely reachable URL.
- **New tools do not appear in Alexa+:** after changing MCP tools/resources, redeploy the add-on with the Alexa AI CLI so Alexa refreshes tool metadata.
