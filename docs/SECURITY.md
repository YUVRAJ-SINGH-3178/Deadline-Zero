# Security

## Implemented

- Development bearer token is accepted only outside production; production refuses startup with development authentication.
- Bounded JSON request body, rate limit, Helmet security headers, parameterized SQL, UUID task identifiers, Zod validation, generic HTTP errors, optimistic state revisions, bounded request replay caching, and token/header log redaction.
- Simulation clones state and does not persist.
- CORS allows configured origins only. No arbitrary URL fetch, shell execution, dynamic evaluation, or LLM tool routing is present.

## Release blockers

OAuth authorization-code/PKCE issuance and consent are handled by the trusted external authorization server, not by this MCP resource server. When `AUTH_MODE=oauth`, signed JWT access tokens are validated against its JWKS, issuer, audience, subject, and required scopes. Provider-side redirect allowlisting, consent, token lifetime/revocation policy, and Amazon account linking must be configured before production. Production startup is intentionally blocked unless the JWKS validation settings exist. Do not expose local mode over an untrusted network.

Postgres JSON state is per subject, and revision checks reject stale concurrent updates. The demo auth adapter uses a single local subject. Define data retention, backup expiry, account export, and encryption-at-rest settings before serving real accounts.
