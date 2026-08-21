---
name: frontend-development
description: Generic technical knowledge for building web components, managing state, integrating with APIs, and addressing accessibility and responsiveness. Used by the Frontend Agent, independent of any specific framework.
---

# Frontend Development

## Purpose

Generic, framework-agnostic frontend engineering knowledge — the
principles behind good component design, state management, and UI
integration, independent of which specific framework the project uses
(that's determined by `project-knowledge` / Tech Decision).

## Component design

- A component should have a clear, single visual/functional purpose —
  avoid components that both fetch data, manage complex local state, and
  render several unrelated concerns.
- Prefer composition (small components combined) over large components
  with many conditional branches for different states.
- Props/inputs should be explicit and typed where the language/framework
  supports it — avoid implicit reliance on shared/global state where a
  direct prop would do.

## State management

- Keep state as local as possible; lift it up only when genuinely shared
  between components.
- Distinguish UI state (open/closed, hover, form input before submit)
  from application/domain state (data from the backend) — they often
  deserve different management strategies.
- Avoid storing derived data in state when it can be computed from
  existing state — that computed value can drift out of sync otherwise.

## API integration

- Handle loading, success, and error states explicitly for every API
  call — a UI that only handles the success case isn't done.
- Don't assume a request will complete quickly; design for the
  possibility of failure and retry where appropriate.

## Accessibility

- Semantic HTML elements over generic `div`/`span` with attached
  behavior, wherever the semantic element exists for the purpose.
- Interactive elements must be keyboard-operable, not just mouse/touch.
- Meaningful labels for form inputs and interactive controls, not just
  placeholder text as the only label.
- Sufficient color contrast for text and meaningful UI elements.

## Responsiveness

- Design for the range of screen sizes the project actually needs to
  support, not just desktop-then-adapt or mobile-then-adapt as an
  afterthought.
- Test layout behavior at real breakpoints, not just by resizing a
  browser window casually.

## Technical UX

- Implement interaction behavior exactly as specified — if a detail is
  ambiguous (e.g., what happens on a specific edge case), flag it rather
  than inventing plausible-sounding behavior.
- Loading and error states should give the user a clear next step, not
  just a spinner or a blank state indefinitely.

## How this is used

The Frontend Agent applies this while implementing, alongside
`business-rules` (targeted consultation), `clean-code`, `coding-standards`,
and `security`.
