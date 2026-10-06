# Deployment

## Local Docker

1. Copy `.env.example` to `.env` and set a random `DEV_BEARER_TOKEN` (at least 16 characters).
2. `docker compose up --build`.
3. `GET /health` and `/ready` should return healthy. Database schema comes from `db/migrations/001_user_state.sql` when the volume is first initialized.
4. For an existing database, run `npm run migrate` with `DATABASE_URL` set before starting the app.

Compose is a local/demo configuration, not a production recipe: it enables development auth and must only run on a trusted local machine. Before deployment, configure the approved OAuth issuer/JWKS/audience and account-linking provider, secret manager, TLS ingress, production database, backups, and trusted origin policy. Production mode refuses development auth. See [CONFIGURATION.md](CONFIGURATION.md) for every environment variable.

## Production checklist

- HTTPS public endpoint; remote Streamable HTTP.
- Approved OAuth 2.1 AS with PKCE S256 and resource audience; validate bearer tokens against trusted issuer keys or introspection.
- `DATABASE_URL`, connection pool sizing, migration execution, encrypted backups.
- Set `ALLOWED_ORIGINS` narrowly; provision secrets out of band.
- Run health/readiness checks and observe structured logs without task text or credentials.
- Alexa+ CLI generated package and simulator check.
