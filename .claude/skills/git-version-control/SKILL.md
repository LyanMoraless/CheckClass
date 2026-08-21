---
name: git-version-control
description: Standards for commits, branches, pull requests, merging, and versioning. Used by every implementation agent when producing commits, and by the Code Reviewer and DevOps agents when reviewing history or configuring pipelines around it.
---

# Git & Version Control

## Purpose

Generic version-control conventions and practices, independent of any
project-specific branch naming that might be layered on top via
`coding-standards`/`project-knowledge` if the project defines one.

## Commits

- Each commit represents one logical change — avoid bundling unrelated
  changes into a single commit, and avoid splitting one logical change
  across many incomplete commits.
- Commit messages state *what* changed and, when not obvious, *why* —
  not just "fix" or "update".
- Prefer a consistent message format (e.g., a short imperative summary
  line, optionally followed by a body with more context for non-trivial
  changes).
- Commit messages are written in English, per this project's coding
  identity (see `coding-standards/references/coding-identity.md`).

## Branches

- Branch names should communicate their purpose (feature, fix, chore)
  clearly enough that someone else understands intent without opening it.
- Keep branches short-lived where practical — long-lived branches
  diverge further from the main line and become harder to merge safely.
- Don't work directly on the main/production branch for anything beyond
  what the project's workflow explicitly allows.

## Pull requests / merge requests

- A PR should be reviewable — reasonably scoped, with a description that
  explains what changed and why, not just a link to a ticket.
- Link the PR to the relevant context (the requirement, the flagged
  issue) so a reviewer isn't reconstructing intent from the diff alone.
- Address review feedback with either a code change or an explicit,
  reasoned response — don't silently ignore a review comment.

## Merging

- Prefer a merge strategy that keeps history readable (this depends on
  team/project convention — follow what's already established in
  `project-knowledge` if defined).
- Resolve conflicts by understanding both sides' intent, not by
  mechanically picking one side — a conflict often signals two changes
  that need to be reconciled logically, not just textually.

## Versioning

- If the project follows a versioning scheme (e.g., semantic versioning),
  apply it consistently — a breaking change bumps the version
  accordingly, not just "whenever it's convenient."
- Tag releases meaningfully so a specific deployed state can be traced
  back to the exact commit it came from.

## History as a resource

- Commit history is a debugging and context tool — write it as if
  someone will need to understand *why* a change was made months later,
  not just *that* it was made.

## How this is used

Every implementation agent follows these conventions when producing
commits for its work. The Code Reviewer Agent may reference commit/PR
quality as part of a review. The DevOps Agent references branch/tag
conventions when configuring CI/CD triggers.
