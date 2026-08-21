---
name: code-review
description: Methodology for reviewing code effectively - what to look for, in what order, and how to give actionable feedback. Used by the Code Reviewer Agent.
---

# Code Review

## Purpose

The **methodology** of reviewing code well — as distinct from
`clean-code` (what good code looks like) and `coding-standards` (what
conventions to check). This skill is about the review process itself.

## Review order (most to least critical)

1. **Correctness** — does it do what it's supposed to do? Are there
   logic errors, unhandled edge cases, race conditions?
2. **Security** — does it violate a defined security practice? (Checked
   against `security`, not redefined here.)
3. **Architecture consistency** — does it fit the recorded architecture,
   or does it introduce a silent deviation?
4. **Maintainability** — is it readable, reasonably structured, free of
   obvious code smells? (Checked against `clean-code`.)
5. **Standards adherence** — naming, organization, personal coding
   identity. (Checked against `coding-standards`.)
6. **Performance** — obvious inefficiencies only; deep optimization isn't
   a review-time concern (that's the Performance Agent's job on demand).

Reviewing in this order matters: a beautifully styled function with a
logic bug is still broken. Don't let style feedback overshadow a real
correctness or security issue.

## What makes feedback actionable

- Point to the specific line/block, not "somewhere in this function."
- Say what's wrong AND what a better version would look like — not just
  "this could be improved."
- Distinguish "this must change" from "this is a suggestion" — don't make
  every comment sound equally urgent.
- If a pattern repeats across the file (the same smell in 5 places),
  don't repeat the same comment 5 times — flag it once as a pattern and
  reference where it recurs.

## Severity classification

- **Blocking** — bug, security issue, or violation of an established
  standard/architecture that must be fixed before this is considered
  done.
- **Non-blocking / suggestion** — genuinely optional improvement; the
  code works and is acceptable as-is, but this would make it better.

Never present a non-blocking suggestion with blocking-level urgency, and
never downplay an actual blocking issue to "just a suggestion."

## What NOT to do in a review

- Don't rewrite business logic during a review — flag it for the
  responsible agent.
- Don't approve code with a known security or correctness issue "because
  it mostly works."
- Don't give vague, non-actionable comments.
- Don't flag a deviation from `coding-identity.md` differently (more
  leniently) than a deviation from generic standards — both are standards
  deviations.

## How this is used

The Code Reviewer Agent follows this methodology when producing its Code
Review Report, ensuring reviews are consistent, prioritized correctly,
and genuinely useful rather than a scattershot list of opinions.
