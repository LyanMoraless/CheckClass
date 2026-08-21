# Coding Identity — Project-Specific Conventions

> This file holds the user's personal coding-style preferences. It is a
> **layer on top of** the general best practices already covered by the
> `coding-standards` and `clean-code` skills — it does not override or
> contradict them. Where this file is silent on something, the general
> best-practice guidance in this skill applies.

This file is consulted by implementation agents (Backend, Frontend,
Mobile, Database, IoT, Computer Vision) and by the Code Reviewer Agent,
alongside the generic `coding-standards` and `clean-code` knowledge.

## Language

- All code — variable names, function names, class names, comments, commit
  messages — is written **100% in English**, regardless of the spoken
  language used in product/business documentation.
- Names favor a compact, preposition-free English phrasing over a literal
  translation. E.g., rather than translating "calcular soma de números"
  word-for-word into something like `calculateSumOfNumbers`, prefer a
  tighter form such as `numberSumCalc` / `sumCalc` — English naturally
  drops most prepositions when phrased this way, and that compactness is
  the preferred style.
- This applies across the whole codebase (backend, frontend, mobile,
  database identifiers, IoT firmware, tests) — not just user-facing
  strings, which follow their own localization rules defined elsewhere
  (`business-domain` / product requirements), not this file.

## Naming

- **Variables and functions:** camelCase.
- **Files:** kebab-case (e.g., `my-file.ts`).

## Function size

- No fixed line-count limit. Guided by the **Single Responsibility
  Principle**: a function should do one thing. In practice, this tends to
  produce many small, focused functions rather than few large ones — but
  the guiding rule is cohesion/responsibility, not a line count.

## Comments

- Minimal by default — code should be self-explanatory through naming and
  structure.
- Comments are added only to explain **non-obvious or complex logic**
  (the "why", not the "what").

## Error handling

- Centralized error-handling layer (e.g., middleware) is preferred over
  scattering try/catch throughout the codebase.
- Errors should be caught and normalized at a central point rather than
  handled ad hoc at each call site.

## String quoting

- No enforced preference — follow the default convention of the language
  or framework in use.

## Folder / module organization

- Layered structure preferred: **controller / service / repository**
  separation within a module, rather than pure feature-based grouping.

## Asynchronous code style

- Chained Promises (`.then()` / `.catch()`) are preferred over
  `async`/`await`, when the language/stack supports both.

## Dependency handling between classes/modules

- Direct imports for simple dependencies.
- Explicit dependency injection (constructor/DI container) reserved for
  cases where it is actually needed — not used by default for everything.

## Test naming

- Direct function name + scenario, e.g. `test_calculateTotal_withDiscount`
  — not nested `describe/it` ("should do X when Y") style, and not
  Given/When/Then phrasing.

---

## How this file should evolve

- This file is meant to be **stable** — it reflects the user's personal
  coding identity, not something that changes per task.
- If the user later wants to change a preference, that is a deliberate,
  explicit update (not something any agent infers or adjusts on its own).
- No agent other than the user (via direct confirmation) should modify
  this file.
