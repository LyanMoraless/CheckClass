---
name: qa
description: Processes for functional validation - checking acceptance criteria, testing expected behavior, regression, exploratory validation, and functional quality. Used by the QA Agent to validate business/user-facing correctness, distinct from testing, which validates technical correctness.
---

# QA

## Purpose

Generic methodology for **functional/business validation** — checking
that what was built actually does what was requested, from the
perspective of whoever uses the system. This is distinct from `testing`
(technical correctness) — code can pass every technical test and still
fail QA if it doesn't match what was actually needed.

## Validating acceptance criteria

- Check each criterion from the Business Analyst's Requirements Analysis
  individually — don't validate "the feature generally" as one lump
  judgment.
- A criterion is either met, not met, or partially met — record which,
  don't round up an ambiguous case to "met."
- If a criterion itself seems wrong or outdated given what was actually
  built, that's a flag back to the Business Analyst, not something to
  silently reinterpret.

## Testing expected behavior

- Walk through the main flow and realistic alternate flows as an actual
  user/actor would, not just by inspecting code.
- Compare observed behavior against `business-rules` for anything rule-
  governed, not just against what "seems reasonable."

## Regression testing

- When a change is made, check that previously working behavior in
  related areas still works — a fix in one place silently breaking
  another is a common failure mode.
- Prioritize regression checks on areas known to be coupled to the
  change (per `project-knowledge`/Architecture Decision), not just the
  directly modified feature.

## Exploratory validation

- Beyond the defined acceptance criteria, spend some effort trying
  realistic-but-unspecified usage paths — real users don't always follow
  the happy path exactly as written.
- Anything found this way that reveals a genuine gap should be flagged
  as a new/missing acceptance criterion, not silently fixed.

## Functional quality

- Something can work technically and still be a functional quality
  problem (e.g., a confusing error message, an inconsistent behavior
  between two similar screens) — this is in scope for QA even without a
  formal acceptance criterion covering it.

## Verdict criteria

- **Approved** — every criterion met, no regressions, no significant
  functional-quality issues found.
- **Approved with reservations** — non-blocking issues found; documented,
  but don't prevent considering the feature usable.
- **Rejected** — a criterion isn't met, or a regression/quality issue is
  serious enough to block.

## How this is used

The QA Agent applies this after the Testing Agent's technical validation
is complete, producing the QA Validation Report. It never writes
automated tests itself and never fixes what it finds — it flags issues
back to the Orchestrator and the responsible agent.
