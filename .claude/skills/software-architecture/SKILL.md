---
name: software-architecture
description: Generic knowledge of architectural patterns (modular monolith, microservices, event-driven, layered, hexagonal, Clean Architecture), and criteria for evaluating dependencies, coupling, and cohesion. Used primarily by the Solution Architect Agent, and referenced by Performance, Refactoring, and Project Guardian.
---

# Software Architecture

## Purpose

Generic architectural knowledge — patterns and the criteria for choosing
between them. This skill doesn't decide anything about a specific
project; it equips the Solution Architect Agent to make and justify that
decision using `project-knowledge` as the source of current context.

## Architectural patterns (when each tends to fit)

- **Layered architecture** — clear separation (e.g., presentation /
  application / domain / infrastructure). Good default for small-to-
  medium systems where the team wants clear boundaries without much
  operational overhead.
- **Modular monolith** — a single deployable unit, internally organized
  into well-bounded modules with enforced boundaries. Good when the team
  is small, deployment simplicity matters, but the domain benefits from
  clear separation of concerns.
- **Microservices** — independently deployable services. Justified when
  independent scaling, independent deployment cadence, or team autonomy
  are real requirements — not by default, since it adds real operational
  complexity (network calls, distributed data consistency, deployment
  orchestration).
- **Event-driven architecture** — components communicate via events
  rather than direct calls. Fits when components need to be decoupled in
  time (producer doesn't need consumer to be available) or when multiple
  components need to react to the same occurrence.
- **Hexagonal architecture (ports & adapters)** — the domain core is
  isolated from external concerns (DB, UI, external services) through
  defined ports. Fits when the domain logic needs to remain stable while
  external technology choices change over time.
- **Clean Architecture** — concentric layers with dependencies pointing
  inward toward the domain. Similar goal to hexagonal (protect the
  domain from infrastructure change), with a more prescriptive layering.

No pattern is "best" in the abstract — the choice must be justified by
the actual requirements (scale, team size, change frequency, deployment
constraints) captured for that specific decision, not by trend.

## Coupling and cohesion

- **Coupling**: how much one component depends on the internal details of
  another. Lower coupling is generally better, but zero coupling isn't
  the goal — some coupling is necessary for components to collaborate at
  all. Watch for coupling that crosses a boundary that was supposed to be
  independent (e.g., a UI component depending on a database schema
  detail).
- **Cohesion**: whether the responsibilities grouped in one component
  actually belong together. Low cohesion (a component doing unrelated
  things) is a sign a component should be split.

## Evaluating scalability

- What's the expected growth dimension: data volume, request volume,
  number of integrations, team size?
- Does the proposed structure require a rewrite to handle 10x growth in
  that dimension, or does it degrade gracefully?

## Evaluating impact of change

- What already-recorded architectural decisions does this change touch?
- Does it require introducing a new component, or does it fit inside an
  existing one?

## How this is used

The Solution Architect Agent applies this when producing an Architecture
Decision. The Performance Agent and Refactoring Agent reference it when a
fix requires understanding architectural boundaries. The Project Guardian
references it when checking whether an implementation stayed within the
recorded architecture.
