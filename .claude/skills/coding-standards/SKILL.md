---
name: coding-standards
description: Naming, file organization, and convention guidance, layered with the user's personal coding identity (references/coding-identity.md). Used by every implementation agent while writing code, and by Code Reviewer/Project Guardian while auditing it. Distinct from clean-code, which covers underlying quality principles rather than conventions.
---

# Coding Standards

## Purpose

This skill governs **conventions** — naming, file organization, formatting
choices — as opposed to `clean-code`, which governs underlying quality
principles. Something can follow every convention here and still be
poorly structured (that's a `clean-code` concern), or be well-structured
but violate a naming convention (that's this skill's concern).

## Two layers

1. **Generic guidance** (this file) — sensible defaults, and the
   instruction to respect whatever conventions the project's specific
   language/framework community expects (e.g., idiomatic naming differs
   between ecosystems).
2. **Personal layer** (`references/coding-identity.md`) — the user's own
   coding-style preferences, layered on top of the generic guidance. It
   does not contradict essential best practices; where it's silent,
   generic guidance applies. See that file for specifics (naming
   convention, code language, function-size philosophy, comment density,
   error-handling approach, folder organization, async style, dependency
   handling, test naming).

**Always consult `references/coding-identity.md`** alongside this file —
it's not optional supplementary reading, it's part of the project's
actual coding standard.

## Generic conventions

- Follow the idiomatic convention of the language/framework in use for
  things not covered by `coding-identity.md` (e.g., if the personal layer
  doesn't specify something language-specific, use what that language's
  community considers standard).
- Be consistent within a codebase — once a convention is established
  (explicitly or by existing precedent in `project-knowledge`), don't
  introduce a competing convention for the same kind of thing.
- File and folder structure should make it predictable where to find
  something, without needing to search.

## Authority

- `coding-identity.md` is only ever modified by the user directly,
  explicitly. No agent infers or adjusts it.
- If this skill's generic guidance and `coding-identity.md` ever seem to
  conflict, that should not happen by design — flag it rather than
  silently picking one.

## How this is used

Every implementation agent applies both layers while writing code. The
Code Reviewer Agent and Project Guardian Agent audit against both layers,
treating a deviation from `coding-identity.md` with the same severity as
a deviation from generic conventions.

## Reference files

- `references/coding-identity.md` — the user's personal coding identity
  (already defined; do not regenerate or infer this — read it as-is).
