# Configuration

Copy `.env.example` to `.env` for local development. The application loads this file in `npm run dev` and `npm run demo:seed`; production environments should inject secrets through their secret manager.

| Variable                       | Required          | Purpose                                                                                                           |
| ------------------------------ | ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                     | No                | `development`, `test`, or `production`; production refuses development authentication.                            |
| `HOST`                         | No                | Bind interface; local default is loopback. Containers set `0.0.0.0`.                                              |
| `PORT`                         | No                | HTTP listener port (default 3000).                                                                                |
| `LOG_LEVEL`                    | No                | Structured logger threshold.                                                                                      |
| `MCP_BASE_URL`                 | No                | Canonical public MCP resource URL used in OAuth metadata.                                                         |
| `PUBLIC_BASE_URL`              | No                | Public site base URL for the landing, privacy, terms, and store-asset routes. Defaults to MCP URL without `/mcp`. |
| `DATABASE_URL`                 | No for local demo | PostgreSQL connection URL; without it, state is process-memory only.                                              |
| `AUTH_MODE`                    | No                | `development` or `oauth`. Production requires `oauth`.                                                            |
| `DEV_BEARER_TOKEN`             | Local only        | Bearer token for local development; replace it for any trusted local tunnel. Never use in production.             |
| `ALLOWED_ORIGINS`              | No                | Comma-separated exact browser origins; no wildcard is used.                                                       |
| `OAUTH_ISSUER`                 | OAuth required    | Trusted authorization-server issuer URL.                                                                          |
| `OAUTH_AUTHORIZATION_ENDPOINT` | OAuth required    | Registered provider authorization endpoint.                                                                       |
| `OAUTH_TOKEN_ENDPOINT`         | OAuth required    | Registered provider token endpoint advertised to Alexa+.                                                          |
| `OAUTH_AUDIENCE`               | OAuth required    | Expected access-token audience/resource.                                                                          |
| `OAUTH_JWKS_URL`               | OAuth required    | Trusted HTTPS JWKS endpoint used to validate signed JWTs.                                                         |

The authorization server must implement OAuth 2.1 authorization-code flow with PKCE S256 and account consent. The resource server validates JWT issuer, audience, signature, subject, and both task scopes. OAuth provider endpoints and credentials are external deployment dependencies.
