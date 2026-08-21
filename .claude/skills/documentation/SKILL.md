---
name: documentation
description: Standards for technical documentation - APIs, architecture, ADRs, decisions, and diagrams - written as concise HTML with an overview-first structure. Used by the Documentation Agent, paired with references/brand-style.md for visual styling (applied only when confirmed for the current project).
---

# Documentation

## Purpose

Standards for producing documentation that's actually useful — concise,
example-driven, and structured so a reader gets the gist immediately and
can go deeper only where they need to. See the Documentation Agent
(`documentation.md`) for the full writing rules and branding-decision
process; this skill is the reference for those standards.

## Structure every document follows

1. **Overview** — a few plain sentences: what this is, who it's for, what
   problem it solves. No jargon.
2. **Details** — technical depth, organized into clear sections, favoring
   concrete examples over abstract explanation.

## ADRs (Architecture Decision Records)

Record decisions using a consistent, minimal structure:

```markdown
# ADR: <short title>

**Status:** Proposed / Accepted / Superseded
**Context:** what prompted this decision
**Decision:** what was decided
**Alternatives considered:** brief list
**Consequences:** what this makes easier, what it makes harder
```

Source ADR content from the Solution Architect's and Tech Decision's
actual outputs — never draft the decision itself here, only record it.

## API documentation

- Document each endpoint's purpose in one sentence before the technical
  contract.
- Include a real example request and response, not just a schema.
- Document error responses with the same care as success responses.

## Diagrams

- Use a diagram when it conveys structure/flow faster than prose would
  (architecture overview, request flow, state machine) — not for
  everything by default.
- Keep diagrams focused on one concern; a diagram trying to show
  architecture, data flow, and deployment simultaneously usually helps no
  one.

## Format and style

- Output format is **HTML**, not PDF (diffable, editable, opens directly
  in a browser). Include an embedded `@media print` stylesheet for
  browser-based PDF export when needed.
- Visual styling (fonts, logo, brand treatment) follows
  `references/brand-style.md` — but **only** when
  `project-knowledge/references/branding.md` confirms branding applies to
  this project. Default is unbranded, neutral styling.

## Avoiding duplication

- Reference the source of truth (`business-rules`, `project-knowledge`,
  a specific agent's report) instead of copying its content into
  documentation — documentation should point to the authoritative source,
  not become a second, driftable copy of it.

## Keeping documentation current

- A divergence between documented and actual behavior is a real defect,
  not a low-priority cleanup item — flag it the same way a bug would be
  flagged.

## How this is used

The Documentation Agent applies these standards for every documentation
task, checking `project-knowledge/references/branding.md` first to decide
whether `references/brand-style.md` applies.

## Reference files

- `references/brand-style.md` — visual styling rules (fonts, logo,
  color), applied conditionally per project.
- `references/assets/` — where the logo file (`logo.svg`/`logo.png`) is
  placed by the user when available.
