---
name: testing
description: Generic methods for unit, integration, E2E, API, load, security, and hardware testing, plus edge-case identification and test automation. Used by the Testing Agent to determine what to test and how, technically - distinct from QA, which validates business/acceptance correctness.
---

# Testing

## Purpose

Generic methodology for **technical** test coverage — verifying code
works as intended, independent of whether that intent matches business
expectations (that's `qa`'s concern).

## Test levels and when each applies

- **Unit tests** — isolated logic, no external dependencies (or
  dependencies mocked). Fast, focused, the majority of test volume
  should live here for logic-heavy code.
- **Integration tests** — verify that components (e.g., service +
  database, service + external API) work correctly together. Fewer than
  unit tests, but essential for catching issues unit tests can't see.
- **E2E tests** — full flows through the system as a user/external
  system would experience them. Fewest in number (slow, more brittle),
  reserved for critical paths.
- **API tests** — contract validation: request/response shape, status
  codes, error responses, boundary values.
- **Load tests** — behavior under concurrent/high-volume usage; needed
  when scale is a real requirement, not by default for every feature.
- **Security tests** — technical validation that a defined security
  practice (from the Security Agent) actually holds (e.g., an
  unauthorized request is actually rejected).
- **Hardware tests** — for IoT-related code, validating behavior under
  real device conditions: connection loss, restart, degraded signal.

## Identifying edge cases

- Boundary values (empty, zero, maximum, one more than maximum).
- Unexpected input types/formats, when the language/context allows them.
- Concurrent access to the same resource.
- Failure of a dependency the code relies on (network, database,
  external service).
- The exceptions/conditions already identified in `business-rules` for
  the feature under test — these must have corresponding coverage.

Don't skip an edge case because it's "unlikely" — at minimum identify it;
whether it's worth covering is a decision that should be explicit, not
silent.

## Test automation

- Tests should be runnable repeatably without manual setup steps beyond
  what's documented.
- Integrate into the project's pipeline (via DevOps) so tests run
  automatically, not only when someone remembers to run them manually.

## What a good test looks like

- Tests one thing, and its name says what that thing is (see
  `coding-identity.md` for this project's test-naming convention).
- Fails with a clear signal of *what* broke, not just "test failed."
- Doesn't depend on execution order or leftover state from another test.

## How this is used

The Testing Agent applies this for every delivery from an implementation
agent, and when defining a test strategy ahead of implementation. It
coordinates with `business-rules` (targeted consultation, to ensure
exception coverage) and hands off to `qa` for business-correctness
validation once technical coverage is complete.
