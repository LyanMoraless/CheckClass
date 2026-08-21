---
name: mobile-development
description: Generic technical knowledge for mobile app architecture, local storage, synchronization, notifications, and lifecycle handling. Used by the Mobile Agent, independent of any specific platform/framework.
---

# Mobile Development

## Purpose

Generic, platform-agnostic mobile engineering knowledge — independent of
whether the project uses native, cross-platform, or a specific framework
(determined by `project-knowledge` / Tech Decision).

## Mobile architecture

- Organize code so business/domain logic is separate from
  platform-specific UI code, where the chosen framework allows it — this
  makes logic easier to test and reduces platform-lock-in of the core
  logic.
- Respect the platform's expected navigation and lifecycle patterns
  rather than fighting them.

## Backend integration under real connectivity conditions

- Never assume the network is reliably available — every API call needs
  an explicit strategy for slow, intermittent, or absent connectivity.
- Distinguish "no connection" from "server error" from "request timeout"
  in both handling logic and user feedback.
- Retry strategies should avoid hammering the backend on repeated
  failure (backoff), and should be bounded, not infinite.

## Synchronization

- Be explicit about what happens when local and remote data diverge
  (conflict resolution strategy) — this should follow a rule that's
  actually specified, not an assumption of "last write wins" by default.
- Queue actions taken offline for later sync, rather than silently
  dropping them.

## Local storage

- Store only what's actually needed locally — don't cache sensitive data
  longer or more broadly than necessary.
- Sensitive data in local storage must be protected appropriately (see
  `security`) — plain, unencrypted storage of credentials or tokens is
  not acceptable.

## Notifications

- Implement exactly the trigger conditions specified — don't add
  notification triggers that weren't requested, since notification
  fatigue is a real UX cost.
- Handle the case where notification permission is denied gracefully.

## App lifecycle

- Handle backgrounding/foregrounding, and process termination and
  restoration, explicitly — state should not be silently lost when the
  OS reclaims resources.
- Be mindful of what work continues (or shouldn't continue) when the app
  is backgrounded.

## Mobile experience

- Follow platform-native interaction conventions (gestures, navigation
  patterns) unless the project has explicitly specified otherwise.
- Don't invent adaptive behavior (e.g., showing different UI based on
  user type or context) unless that's an explicit, confirmed requirement
  — this is a product decision, not a technical default.

## How this is used

The Mobile Agent applies this while implementing, alongside
`business-rules` (targeted consultation), `clean-code`, `coding-standards`,
and `security`.
