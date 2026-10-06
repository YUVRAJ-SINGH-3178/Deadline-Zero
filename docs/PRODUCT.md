# Product

Deadline Zero is for people whose plans change faster than their task lists. The first interaction captures a task in ordinary language; the planner produces a short, realistic sequence and explains risks. A new interruption triggers replanning while a hypothetical skipped task uses a read-only simulation.

## Supported today

Task capture is bounded to 500 saved tasks per account, and an individual plan is bounded to a seven-day window to keep responses predictable.

- Task capture with title, description, estimate, deadline/start window, priority, flexibility, and prerequisite references.
- Deterministic schedule generation around unavailable intervals.
- Partial task correction, task completion, progress, next action, and focus-session tracking.
- Explainable replan version, task impact, and isolated skip simulation.
- Text-first voice-compatible tool output and a glanceable screen resource.

## Product boundaries

The current build does not infer tasks from arbitrary prose itself; Alexa or another conversational host extracts the fields. It does not read personal calendars, send reminders, or auto-run actions. Missing estimates should be clarified in the conversation. Dates are represented as ISO timestamps and are interpreted by the host; a production account profile must persist a customer time zone.
