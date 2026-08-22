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
- **Confirmed exception (2026-08-21, CheckClass backend/NestJS):** when the
  approved tech stack is NestJS, organize by feature/pipeline-stage module
  (one folder per module, service calling the repository layer directly via
  `manager.getRepository(...)` with no separate repository class) instead of
  the controller/service/repository split above. This isn't a reversal of
  the general preference — it's NestJS's own idiomatic module convention
  (guards/interceptors/lifecycle hooks are built around it), and fighting it
  produces less idiomatic, harder-to-maintain code for no real benefit. Only
  applies when NestJS (or a similarly opinionated framework) is the
  confirmed stack; the general preference above still applies elsewhere.
- **Confirmed exception (2026-08-22, CheckClass frontend/React):** when the
  approved stack is React, organize by feature/page (colocated components,
  hooks, and API calls per feature folder) instead of the controller/
  service/repository split — that layering doesn't map cleanly onto a
  component-based SPA to begin with. Same reasoning as the NestJS exception:
  follow the framework's own idiom rather than fight it.

## Asynchronous code style

- Chained Promises (`.then()` / `.catch()`) are preferred over
  `async`/`await`, when the language/stack supports both.
- **Confirmed exception (2026-08-21, CheckClass backend/NestJS):** use
  `async`/`await` throughout when the stack is NestJS. Guards, interceptors,
  and lifecycle hooks (`onModuleInit`, etc.) are written and consumed as
  `async` functions across the framework and its ecosystem; chaining
  `.then()/.catch()` against that idiom adds friction without upholding the
  underlying reason for the general preference. Only applies when NestJS
  (or a similarly `async`-idiomatic framework) is the confirmed stack.
- **Confirmed exception (2026-08-22, CheckClass frontend/React):** use
  `async`/`await` throughout when the stack is React (hooks, event handlers,
  and TanStack Query's query/mutation functions are near-universally written
  this way in the ecosystem). Same reasoning as the NestJS exception.

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
