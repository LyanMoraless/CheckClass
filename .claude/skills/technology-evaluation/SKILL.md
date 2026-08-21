---
name: technology-evaluation
description: Method for evaluating languages, frameworks, libraries, databases, services, and tools objectively - the criteria and comparison structure used by Tech Decision, informed by Research. Not domain-specific to any technology; it's the evaluation method itself.
---

# Technology Evaluation

## Purpose

The **method** for comparing technology alternatives objectively — this
skill doesn't recommend specific technologies (those go stale and vary
per project); it defines the criteria and process so any comparison the
Tech Decision Agent produces is structured, fair, and justified.

## Evaluation criteria

- **Fit for the actual requirement** — does it solve the specific problem
  at hand, not just "is it a good technology in general."
- **Maturity** — how long has it been stable, how battle-tested is it for
  this use case.
- **Maintenance status** — is it actively maintained, what's the release
  cadence, are known issues being addressed.
- **Community and ecosystem** — availability of documentation, libraries,
  and support when something goes wrong.
- **Performance characteristics** — relevant to the actual expected load,
  not benchmarks for unrelated use cases.
- **Cost** — licensing, hosting, operational cost at the expected scale.
- **Compatibility** — with the stack already approved in
  `project-knowledge`; introducing an incompatible piece has a cost
  beyond the piece itself.
- **Learning curve / team fit** — relevant, but never the sole deciding
  factor over a technology that's clearly the better fit for the
  requirement.
- **Security posture** — known vulnerability history, how actively
  security issues are patched.

## Comparison structure

Every technology decision compares **at least one real alternative**,
even when the answer seems obvious — the comparison itself is what makes
the decision auditable later:

```
Problem → Requirements → Alternatives → Advantages/Disadvantages of each
→ Trade-offs → Recommendation → Justification
```

## What NOT to do

- Don't recommend based on popularity/hype alone — popularity is one
  signal (community/ecosystem), not a substitute for fit.
- Don't compare against a strawman alternative just to make the preferred
  option look better — alternatives must be real, reasonable candidates.
- Don't ignore switching/migration cost when comparing against something
  already in use — "technically better" doesn't always outweigh
  "already working and integrated."

## How this is used

The Tech Decision Agent applies this method for every technology
recommendation, which is then submitted for user approval (per
`tech-decision.md`) before becoming official. The Research Agent gathers
the up-to-date facts (maturity, maintenance status, documentation) this
evaluation needs.
