# Contributing

1. Use Node.js 22 or later.
2. Copy `.env.example` to `.env` for local configuration.
3. Install dependencies with `npm install`.
4. Make a focused change and add a behavior test.
5. Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
6. Do not commit credentials, user task data, demo recordings with private information, or fabricated Alexa+ test evidence.

Planning behavior should remain deterministic and explainable. What-if changes must operate on cloned state. Never add a tool schema field the implementation silently ignores.
