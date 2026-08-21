---
name: business-domain
description: Knowledge of the segment/industry the current project operates in - its actors, roles, typical processes, and domain-specific concepts. Consulted by the Product Definition Agent and Business Analyst before analyzing a request; written to only by the Product Definition Agent, only after explicit user confirmation.
---

# Business Domain

## Purpose

This skill holds what's known about the **domain the project operates
in** — not the project's own rules (that's `business-rules`), and not the
project's technical state (that's `project-knowledge`), but the
surrounding context: who the actors are, what roles they play, what
processes are typical in this kind of system, and what domain-specific
vocabulary means.

This is one of the three **project-specific** skills. Its structure is
reusable across projects; its `references/` content is unique to the
current project and starts empty for a new project.

## What belongs here

- Actors and roles relevant to this project (who uses the system, in
  what capacity).
- Typical processes for this kind of system/segment, as confirmed by the
  user — not assumed from general knowledge of the industry.
- Domain-specific terminology and what it means in this project's
  context.
- How different actor types or usage contexts may lead to different
  behavior in the system (without assuming a specific example — this
  varies entirely per project).

## What does NOT belong here

- Specific business rules (validations, conditions, exceptions) →
  `business-rules`.
- The project's technical architecture → `project-knowledge`.
- General market/competitor research → handled by the Research Agent,
  and only recorded here after user confirmation, following the same
  process as everything else in this skill.

## Authority

- **Read**: primarily the Product Definition Agent and the Business
  Analyst Agent; other agents may reference it for context on actors.
- **Write**: only the Product Definition Agent, and only after explicit
  user confirmation. No agent invents an actor, role, or process here.

## How agents use this

The Product Definition Agent consults this first when trying to
understand who's involved in a new request. The Business Analyst Agent
consults it when identifying actors and flows for a requirement. If an
actor or process mentioned in a request isn't documented here, that's a
gap to flag and confirm — not something to infer from general assumptions
about "how these systems usually work."

## Reference files

- `references/domain-overview.md` — what CheckClass is, its official
  priority order (attendance core > institution management > intrusion
  security > future/AI), segment, and domain terminology.
- `references/actors.md` — actors and roles confirmed so far (student,
  teacher, staff, visitor, VIP, security team, institution as tenant),
  how the interface varies by institution type, and known gaps (internal
  admin role hierarchy).

As the project's domain understanding grows, add further reference files
here (e.g., `references/processes.md`) rather than inflating this
SKILL.md.
