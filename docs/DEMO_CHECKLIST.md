# Demo checklist

## Before recording

- [ ] Clean demo database / known empty user state.
- [ ] Stable network; local fallback rehearsed.
- [ ] Alexa+ builder/test environment available, or local MCP inspector fallback clearly labeled.
- [ ] Public HTTPS MCP endpoint is reachable if using Alexa+.
- [ ] OAuth/account-linking credentials configured in approved secret storage; never paste into recording.
- [ ] Structured logs open with authorization fields redacted.
- [ ] Backup path: run the MCP endpoint locally and show the verified tool calls without implying Alexa certification.
- [ ] Capture the real visual resource only after host rendering is available.

## Exact utterances and expected behavior

| Utterance                                                                                        | Expected behavior                                                                                  |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| “I have three deadlines tonight and only four hours.”                                            | Ask/capture task details conversationally; no unsupported assumption about task identity.          |
| “My assignment is due at midnight, I have an exam tomorrow, and I need to study three chapters.” | Capture tasks or ask for missing estimates; create a deadline-aware plan when its window is known. |
| “I’m unavailable from eight to nine.”                                                            | Replan around the hold and explain moved/at-risk work.                                             |
| “I finished the assignment.”                                                                     | Mark complete and recommend one next action.                                                       |
| “What happens if I skip studying tonight?”                                                       | Return simulation without changing actual task state or plan.                                      |
| “What should I do right now?”                                                                    | Recommend one clear next action.                                                                   |

- [ ] Confirm the what-if view leaves the actual plan unchanged.
- [ ] Avoid claims of certification, production deployment, or device test unless verified.
