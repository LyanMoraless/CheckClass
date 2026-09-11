---
name: commit-conventions
description: CheckClass's project-specific commit-message standard — Conventional Commits types (feat, fix, docs, test, build, perf, style, refactor, chore, ci, raw, cleanup, remove), adapted from https://github.com/iuricode/padroes-de-commits, plus the rule for subdividing a batch of changes into multiple small, single-purpose commits instead of one bundled commit. Project-specific layer on top of the generic `git-version-control` skill. Used by every agent that produces a commit (Backend, Frontend, Mobile, Database, IoT, Computer Vision, Testing, Documentation, Product Definition) and by Code Reviewer/Project Guardian when auditing commit history.
---

# Commit Conventions (CheckClass)

## Purpose

Project-specific layer on top of `git-version-control`'s generic guidance
("one logical change per commit", "state what and, when not obvious, why").
This file defines the exact commit-type vocabulary CheckClass uses
(Conventional Commits, adapted from
[iuricode/padroes-de-commits](https://github.com/iuricode/padroes-de-commits)),
and when a batch of changes must be split into more than one commit
rather than bundled into one.

## Commit types

Every commit message starts with exactly one of these types:

- **`feat`** — a new feature (relates to MINOR in semantic versioning).
- **`fix`** — a bug fix (relates to PATCH in semantic versioning).
- **`docs`** — documentation-only changes (e.g. README, `.doc/**`,
  `.claude/skills/**`). No code changes.
- **`test`** — creating, changing, or removing (unit/integration) tests.
  No code changes.
- **`build`** — changes to build files and dependencies.
- **`perf`** — code changes specifically about performance.
- **`style`** — formatting only: semicolons, trailing spaces, lint fixes.
  No code changes.
- **`refactor`** — changes from refactoring that don't alter
  functionality (e.g. restructuring how a screen is processed while
  keeping the same behavior, or a performance improvement that came out
  of code review — otherwise prefer `perf`).
- **`chore`** — build-task/admin-config/package updates that aren't
  `build` or `ci` specifically (e.g. adding an entry to `.gitignore`). No
  code changes.
- **`ci`** — continuous-integration changes.
- **`raw`** — changes to config, data, feature-flag, or parameter files.
- **`cleanup`** — removing commented-out code, dead snippets, or other
  source cleanup for readability/maintainability.
- **`remove`** — deleting obsolete or unused files, directories, or
  features.

Format: `<type>: <objective description of the change>`.

**Deciding between close types:**
- Bug correction in code → `fix`, never `cleanup`/`refactor`.
- Restructuring with zero behavior change → `refactor`; if it also
  measurably improves performance, prefer `perf`.
- Touches only test files → `test`, even if it's a large addition — not
  `feat`.
- Touches only markdown/HTML documentation, no source → `docs`.
- Dependency/build-tool config (`package.json` deps, bundler config) →
  `build`; broader admin/config housekeeping that isn't build tooling →
  `chore`.

## Language note

The type itself is always in English (as above). The description's
language follows this project's existing precedent (Portuguese, for
business/product-facing history) — a pre-existing choice already baked
into the whole commit history, distinct from
`coding-standards/references/coding-identity.md`'s "commit messages in
English" line, which was written with source-level (English-named code)
commits in mind. This is a flagged inconsistency between the two skills,
not a silent resolution — if the user wants commit descriptions moved to
English going forward, that is a deliberate, explicit change to make in
`coding-identity.md`, not something to infer here.

## Subdivision into multiple commits

When a batch of work touches clearly distinct concerns, split it into
multiple small commits instead of one bundled commit — each with its own
type and description. "Distinct concern" typically lines up with one of:

- Planning / business-rule documentation (`.claude/skills/**` references,
  `pending-decisions.md`, requirement/architecture write-ups) → `docs`.
- One implementation layer or module at a time (a backend feature, a
  frontend feature, a database migration) — not "backend and frontend
  together" if they can be committed separately → `feat`/`fix`/etc.
- Test coverage written for already-implemented code → `test`.
- Closing documentation written after implementation (architecture/
  decision records, `.doc/**` HTML) → `docs`.

Example (hypothetical "Assistente de Chamada" feature):

1. `docs: planejamento da feature de Assistente de Chamada` (md files
   under `.claude/skills/**`)
2. `feat: tela de Assistente de Chamada` (frontend feature files)
3. `fix: ajuste no layout da home principal` (an unrelated bug fix
   bundled into the same batch of work)
4. `docs: documentação da feature de Assistente de Chamada` (`.doc/**`
   HTML)

Order the commits so each one leaves the repo in a coherent state on its
own where practical — planning before implementation, implementation
before closing documentation. This also makes `git log` read as a
narrative of how the work happened, not just a stack of unrelated diffs.

## When NOT to subdivide

A single, small, cohesive change (one bug, one file, one clearly atomic
adjustment) stays as one commit — subdividing it further would violate
`git-version-control`'s "don't split one logical change across many
incomplete commits" rule.

## How this is used

Every implementation, testing, documentation, and product-definition
agent applies this when producing commits for CheckClass. Code Reviewer
and Project Guardian check commit messages against this format when
auditing history.
