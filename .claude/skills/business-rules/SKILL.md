---
name: business-rules
description: The official, exclusive source of this project's business rules - validations, permissions, exceptions, and required behaviors. Every implementation agent consults specific rules here by reference (never by free exploration); written to only by the Product Definition Agent, only after explicit user confirmation. Never invent a rule that isn't here.
---

# Business Rules

## Purpose

This skill is the **single official source of business rules** for the
current project. If a rule isn't here (and isn't newly confirmed by the
user), it doesn't exist — no agent may assume, infer, or invent one.

This is one of the three **project-specific** skills. Its structure is
reusable across projects; its `references/` content is unique to the
current project and starts empty for a new project.

## What belongs here

- Validation rules (what makes input/data valid or invalid).
- Access/permission rules (who can do what, under which conditions).
- Exceptions to a general rule, and the conditions that trigger them.
- Required behaviors the system must always follow, as confirmed by the
  user — expressed precisely enough that different agents (Backend,
  Frontend, Mobile, Database, IoT) can implement the same rule
  consistently without reinterpreting it.

## What does NOT belong here

- Actors, roles, and general domain processes → `business-domain`.
- Technical/architectural decisions → `project-knowledge`.
- Coding conventions → `coding-standards`.

## Rule format (recommended)

Each rule should be identifiable and referenceable — implementation
agents consult this skill **in a targeted way**, by rule ID/name, not by
browsing the whole domain looking for something relevant. A consistent
format helps:

```markdown
### RULE-<short-id>: <short name>

**Statement:** <the rule itself, precisely>
**Applies to:** <what this governs>
**Exceptions:** <if any, or "none">
**Source of confirmation:** <when/how the user confirmed this>
```

Store rules under `references/`, grouped by area if the list grows large
(e.g., `references/access-rules.md`, `references/validation-rules.md`),
so agents can find the referenced rule quickly without reading everything.

## Authority

- **Read**: every implementation agent (Backend, Frontend, Mobile,
  Database, IoT, Computer Vision), always in a **targeted** way — reading
  the specific rule(s) referenced by the Business Analyst for their task,
  never exploring the whole file "looking for" rules.
- **Write**: only the Product Definition Agent, and only after explicit
  user confirmation. The Business Analyst Agent identifies and proposes
  new rules but does not write them directly — it flags them back for
  confirmation and recording.

## How agents use this

1. The Business Analyst identifies which rules apply to a requirement and
   references them by ID/name in its Requirements Analysis.
2. Implementation agents read the full text of only those referenced
   rules before implementing.
3. If an agent finds a divergence between the rule's official text and
   what was handed off in the task, it flags this instead of deciding
   which version is correct.
4. If a feature clearly involves a business rule but none was referenced,
   the agent flags the missing reference instead of assuming behavior.

## Reference files

- `references/attendance-rules.md` — RULE-ATT-01..14: multifactor
  attendance, configurable required factors, presence vs. check-in,
  minimum permanence percentage, check-in tolerance, multiple check-in
  mechanisms, missing-factor pendency, multi-interval permanence
  summing, undetected-exit pendency, check-in deduplication, pendency
  never auto-expires, pendency resolution via direct leadership
  hierarchy, institution-custom attendance factors, fixed 3-option
  post-tolerance behavior.
- `references/access-control-rules.md` — RULE-ACC-01..07: wristband/tag
  identity, configurable categories, area-access decision criteria,
  unauthorized-attempt logging, facial recognition as optional factor,
  camera purpose-driven tech, camera permissions.
- `references/security-intrusion-rules.md` — RULE-SEC-01..06: intrusion
  detection objective, internal geolocation via IR barriers, cameras
  auto-following an intruder, automatic lockdown (with the mandatory
  emergency-safety exception), entry/exit counting caveats, configurable
  surveillance levels.
- `references/multi-tenancy-rules.md` — RULE-TEN-01..02: total data
  isolation between institutions, privacy/LGPD by design. Includes a
  2026-08-31 correction note: deployment model changed to one dedicated
  instance per institution, while the technical tenant_id+RLS isolation
  mechanism stays as defense in depth.
- `references/institution-management-rules.md` — RULE-INST-01..05
  (added 2026-08-31, part of the institution-management structural
  pivot): fixed institution-type enum (faculdade/escola/empresa) and what
  each enables, self-service onboarding with single-instance lock,
  Curso→Matéria→Turma academic modeling, automatic class-session
  generation from a recurring schedule, automatic pending-review
  resolution authority when a teacher is assigned to a class group.
- `references/data-retention-rules.md` — RULE-RET-01..04: 60-day live
  data window before monthly closure archival, annual consolidation
  after 12 monthly closures, per-factor-type deduplication time windows
  (10s point-in-time factors, 2s room entry/exit), technical
  administrator role separate from the pedagogical leadership hierarchy.
- `references/configurable-parameters.md` — index of values that must
  never be hardcoded (minimum attendance %, check-in tolerance, access
  permissions/schedules, surveillance levels, lockdown rules, required
  attendance factors).

Rules are added here only after explicit user confirmation, recorded by
the Product Definition Agent.
