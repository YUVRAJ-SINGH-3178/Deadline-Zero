# Privacy and data handling

## Stored data

Deadline Zero stores task title and optional description/notes, category, deadline and start window, estimate, remaining time, priority, flexibility, status, dependency IDs, manually entered unavailable intervals, current and recent plan versions, focus session, short plan-change reasons, and a bounded cache of the 100 most recent mutation responses for ten minutes. It does not store the raw conversational transcript, use third-party analytics, or send tasks to an LLM. `delete_my_data` clears planning state after the customer clearly requests and confirms deletion.

## Purpose and isolation

Data is used to schedule, replan, simulate, and report progress. Production PostgreSQL keys each state row by the authenticated JWT subject. Local development uses one local subject and process memory unless PostgreSQL is configured. Never use local auth with a public endpoint.

## Retention and deletion

No automatic expiry is configured. Task and plan state remains until the customer calls `delete_my_data`; the server replaces it with an empty revision tombstone to prevent stale concurrent writes from restoring the deleted plan. The authenticated subject identifier and revision remain. Production needs a documented retention period, backup expiry, account export, and deletion policy before public launch. Deleting the application state does not unlink the separate Alexa account or erase database backups immediately.

## Data minimization

Keep task descriptions short and relevant; do not include sensitive personal data. Logs capture request IDs, tool names, timing, outcomes, and error codes, not task contents or bearer tokens.
