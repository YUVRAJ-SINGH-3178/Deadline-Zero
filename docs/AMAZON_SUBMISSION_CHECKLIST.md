# Amazon submission checklist

The prompt names screenshot requirements but no separate screenshot file was present in the workspace. This mapping covers the requirements explicitly transcribed in the supplied brief; compare it with the actual event page before submission.

| Requirement from supplied brief     | Repository artifact / implementation                                          | Evidence                                         | Manual action                                                 |
| ----------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| Alexa+                              | [ALEXA_PLUS.md](ALEXA_PLUS.md); MCP onboarding steps documented               | Genuine simulator or device capture after access | Obtain builder access; create/deploy add-on with Alexa AI CLI |
| MCP server / Agent Skill            | MCP Streamable HTTP implementation and [MCP.md](MCP.md)                       | Initialize, tools/list, and tool-call trace      | Connect server endpoint in generated add-on                   |
| Store manifest and media            | `addon-package/addon.json.template`, `assets/store/`, `/privacy`, `/terms`    | Public HTTPS links after deployment              | Replace hostname and validate with Alexa AI CLI               |
| Working demo                        | [DEMO_SCRIPT.md](DEMO_SCRIPT.md), [DEMO_CHECKLIST.md](DEMO_CHECKLIST.md)      | Recorded end-to-end path                         | Rehearse against live Alexa+ or label local fallback          |
| GitHub repository                   | Source repository files                                                       | Public/eligible repository URL and README        | Publish repo and confirm access settings                      |
| Product feedback                    | Not submitted; truthful prompts in [PRODUCT_FEEDBACK.md](PRODUCT_FEEDBACK.md) | Actual feedback form confirmation                | Submit observed feedback after Alexa+ tooling use             |
| Demo video                          | Script and capture checklist                                                  | Final hosted video URL                           | Record real demo, upload, verify visibility                   |
| Optional AWS Builder mini-challenge | Not included; no unsupported AWS claims                                       | None                                             | Only opt in if a real AWS deployment is completed             |
| Optional Open Source mini-challenge | Not included; no fabricated PR                                                | None                                             | Only opt in after accepted meaningful contribution            |
| Optional feature request            | [FEATURE_REQUEST.md](FEATURE_REQUEST.md)                                      | Submitted request ID/link                        | Submit after checking duplicate requests                      |
| Optional friction log               | [FRICTION_LOG.md](FRICTION_LOG.md), currently no fabricated entries           | Reproducible observations if encountered         | Add only issues personally reproduced in official workflow    |
