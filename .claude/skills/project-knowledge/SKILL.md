---
name: project-knowledge
description: The official, cumulative source of truth about the current project's state - its architecture, modules, components, technologies in use, structure, integrations, past decisions, and known limitations. Consulted by every agent before acting; written to only by the Product Definition Agent, only after explicit user confirmation.
---

# Project Knowledge

## Purpose

This skill is the **official record of what the project currently is** —
not what it should be, not what it once was planned to be, but its actual,
confirmed current state. Every agent consults this before acting, so no
one has to rediscover or guess the project's context from scratch.

This is one of the three **project-specific** skills (along with
`business-domain` and `business-rules`). Its structure and this SKILL.md
are reusable across projects; its `references/` content is unique to the
current project and starts empty or nearly empty for a new project.

## What belongs here

- Current architecture (components, layers, how they're organized).
- Modules and their responsibilities.
- Technologies and versions actually in use (approved via Tech Decision).
- Folder/repository structure conventions specific to this project.
- Integrations with external systems and services.
- Recorded architectural and technical decisions (with their rationale).
- Known limitations or constraints (technical debt, deferred work,
  hardware limits, etc.).
- Project-level configuration facts, such as
  `references/branding.md` (whether the LGI Morales brand identity
  applies to this project's documentation).

## What does NOT belong here

- Business rules → `business-rules`.
- Domain/actor/segment knowledge → `business-domain`.
- Generic engineering best practices → the relevant engineering skill
  (`clean-code`, `software-architecture`, etc.).
- The user's personal coding style → `coding-standards/references/
  coding-identity.md`.

## Authority

- **Read**: every agent, before acting.
- **Write**: only the Product Definition Agent, and only after the user
  has explicitly confirmed the information (see `product-definition.md`
  for the full confirmation process). No other agent writes here.

## How agents use this

Before proposing or implementing anything, an agent checks here first to
understand what already exists, so it doesn't contradict or duplicate a
decision already made. If something relevant isn't documented here, the
agent flags the absence rather than assuming — this file being sparse or
empty (common early in a project) is expected, not an error.

## Reference files

- `references/branding.md` — whether LGI Morales branding applies to this
  project's generated documentation (see the `documentation` skill).
- `references/architecture-overview.md` — conceptual architecture
  (components, reference flows, connectivity), architecture principles,
  and confirmed constraints/premises (multi-tenancy, local edge
  processing, IoT reliability). No specific technology approved yet.
- `references/pending-decisions.md` — decisions explicitly flagged as
  not-yet-defined (AI scope, surveillance levels implementation, entry/
  exit counting technology) and known gaps (internal admin roles,
  interface content for institution types beyond school/company). Consult
  before treating any of these as settled.

As the project grows, add further reference files here (e.g.,
`references/modules.md`, `references/decisions-log.md`) rather than
inflating this SKILL.md — keep this file as the short index/description,
and put the actual cumulative project content in `references/`.
