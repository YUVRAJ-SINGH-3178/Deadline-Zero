# Deadline Zero

**Turn chaos into a plan that adapts.**

## Problem

People often know what they need to do but lack a realistic way to fit it around deadlines, fixed commitments, and interruptions. Static to-do lists leave the hard tradeoffs to the person.

## Solution

Deadline Zero converts conversational task details into a feasible, explainable schedule. When time changes, it replans. When a person wonders about skipping work, it simulates the consequence without altering the real plan.

## Why Alexa+

Planning starts naturally in voice conversation, often while someone is already moving through their day. Alexa+ can combine that conversation with an optional glanceable plan. Deadline Zero keeps its core operations understandable through spoken summaries alone.

## Technical novelty

The core planning loop is deterministic and inspectable rather than delegated to an unconstrained language model. The same planner powers initial scheduling, replanning, and isolated what-if simulations. Versioned plan history explains changes.

## Key features

- Conversationally supplied task capture.
- Deadline, priority, duration, dependency, and availability-aware scheduling.
- Partial corrections that preserve unchanged task details.
- Replanning after interruptions and task completion.
- One-action recommendation and focus session tracking.
- Read-only what-if simulation.
- Clear infeasibility warnings and recovery next steps.

## MCP architecture

Alexa+ → MCP Streamable HTTP server → typed tool handlers → deterministic planner → per-user PostgreSQL state. The server exposes focused tools for task capture, planning, changes, progress, completion, simulation, and focus sessions.

## Multimodal experience

The MCP Apps-compatible view presents a large-type timeline and next action, with no dense dashboard. Voice output is backed by structured text data and does not require the screen.

## Accessibility

Semantic headings, strong contrast, large text, keyboard focus visibility, reduced-motion handling, and a touch-sized primary action are included in the local view. Final Alexa host rendering and accessibility must be checked in the official simulator and on target devices.

## Reliability and security

Deterministic schedule logic, validated inputs, recovery-focused errors, request limits, rate limiting, parameterized SQL, and a production guard against development auth are implemented. Public account linking remains an external integration dependency; the local development bearer token must never be used in production.

## Demo flow

Create a deadline-heavy plan, show its timeline, add an unavailable interval, replan, complete a task, simulate skipping study, and ask for the next action. See [DEMO_SCRIPT.md](DEMO_SCRIPT.md).

## Future potential

With explicit consent, a real calendar adapter and persisted time-zone preferences could make availability more complete. A trusted OAuth integration and more robust schedule optimization can extend the system while keeping its explainable deterministic core.

## Status

This is a hackathon implementation in a local repository. Alexa+ onboarding, external OAuth setup, remote deployment, product feedback submission, and certification have not yet occurred.
