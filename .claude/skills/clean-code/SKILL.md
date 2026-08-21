---
name: clean-code
description: Generic principles for readability, simplicity, cohesion, low coupling, and complexity reduction. Used by every implementation agent, Code Reviewer, and Refactoring - alongside coding-standards, which covers project/personal conventions rather than these underlying principles.
---

# Clean Code

## Purpose

Underlying principles for writing code that's easy to read, understand,
and change — independent of any specific naming convention or file
structure (those are `coding-standards`). This skill answers "is this
code well-written", `coding-standards` answers "does this code follow
our conventions".

## Core principles

- **Readability over cleverness.** Code is read far more often than
  written. A slightly longer, obvious approach beats a compact, clever
  one that requires re-reading to understand.
- **Single Responsibility.** A function, class, or module should have one
  reason to change. This is a guide for *why* something might need to be
  split, not a line-count rule.
- **Meaningful names.** A name should communicate intent without needing
  a comment to explain it. If a name needs a comment to make sense, the
  name is probably wrong.
- **Minimize state and side effects.** Prefer functions whose output
  depends only on their input, where practical. Side effects should be
  explicit and localized, not hidden inside something that looks like a
  pure computation.
- **Avoid deep nesting.** Multiple nested conditionals/loops are a sign
  the logic wants to be decomposed into smaller named pieces, or that an
  early-return/guard-clause style would be clearer.
- **Don't Repeat Yourself (DRY) — but don't force it.** Real duplication
  (the same rule/logic expressed twice, which could drift apart) should
  be consolidated. Coincidentally similar code that represents different
  concepts should NOT be merged just to avoid repetition — that creates
  false coupling.
- **Low coupling, high cohesion.** See `software-architecture` for the
  fuller treatment; at the code level, this means a unit should depend on
  as little as necessary, and everything inside it should belong there.

## Comments

- Comments explain **why**, not **what** — the code itself should make
  the "what" clear.
- A comment that restates what the next line obviously does is noise.
- A comment explaining a non-obvious constraint, a workaround for a known
  issue, or the reasoning behind a non-default choice is valuable.

## Signs code needs attention (code smells)

- Long functions doing several unrelated things.
- Duplicated logic across multiple places.
- Deep nesting that's hard to trace mentally.
- Names that don't match what the thing actually does.
- A function/class that needs to know too much about another's internals
  to work correctly (high coupling).

## How this is used

Every implementation agent (Backend, Frontend, Mobile, Database, IoT,
Computer Vision) applies these principles while writing code. The Code
Reviewer Agent checks adherence to these principles specifically (as
distinct from `coding-standards` conventions). The Refactoring Agent uses
this as its main quality target when improving existing code.
