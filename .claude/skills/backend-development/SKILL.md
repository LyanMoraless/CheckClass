---
name: backend-development
description: Generic technical knowledge for building APIs, services, integrations, persistence, and error handling on the server side. Used by the Backend Agent, independent of any specific framework - framework-specific conventions come from project-knowledge and coding-standards.
---

# Backend Development

## Purpose

Generic, framework-agnostic backend engineering knowledge. This skill
covers *what good backend code does*, not the specific syntax of any
particular framework — that comes from the technology already approved in
`project-knowledge` plus standard framework documentation.

## API design

- Endpoints represent resources/actions clearly; a consumer should be
  able to predict the shape of a related endpoint from an existing one.
- Consistent request/response structure across the API, including error
  responses.
- Version APIs deliberately when introducing a breaking change, rather
  than changing behavior silently under an existing contract.

## Service/application logic

- Business logic belongs in a dedicated layer, not scattered across
  request handlers — this keeps it testable independent of HTTP/transport
  concerns.
- A service function should have a clear, single purpose (ties back to
  `clean-code`'s Single Responsibility principle).

## Integrations

- Treat every external call as something that can fail or be slow — set
  timeouts, handle failure explicitly, don't assume success.
- Isolate integration-specific code behind an interface so the rest of
  the system doesn't depend on a specific external API's shape directly.

## Persistence (in coordination with Database Agent)

- The backend consumes the data layer through a clear boundary — it
  shouldn't need to know low-level query details to use it.
- Transactions should wrap operations that must succeed or fail together.

## Error handling

- Distinguish expected errors (validation failure, not-found, permission
  denied) from unexpected ones (bugs, infrastructure failure) — they
  deserve different handling and different response codes.
- Never leak internal implementation details (stack traces, internal
  paths, query text) in a response to the client.
- Errors should be logged with enough context to debug, without logging
  sensitive data.

## Authentication/authorization (implementation, not strategy)

- Implement exactly what the Security Agent has defined as the strategy
  — this skill covers *how* to implement it correctly, not *what* the
  strategy should be.
- Verify authorization at the service layer, not only at the API gateway/
  route level.

## Observability

- Structured, consistent logging across endpoints/services.
- Meaningful request identifiers/correlation IDs to trace a request
  across components when debugging.

## How this is used

The Backend Agent applies this while implementing, alongside
`business-rules` (targeted consultation), `clean-code`, `coding-standards`,
and `security`.
