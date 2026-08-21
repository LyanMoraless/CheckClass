---
name: design-patterns
description: Generic knowledge of common design patterns and criteria for when applying one is justified versus when it adds unnecessary complexity. Used by Solution Architect, Backend, Frontend, Code Reviewer, and Refactoring agents.
---

# Design Patterns

## Purpose

Generic pattern knowledge and, more importantly, **criteria for whether a
pattern should be applied at all** — patterns solve specific recurring
problems, and applying one where the problem doesn't exist adds
complexity without benefit.

## Core principle

A pattern is justified when it solves a real problem present in the code
right now — not preemptively, "in case it's needed later." Prefer the
simplest structure that solves the current problem; introduce a pattern
when a concrete symptom (duplication, rigidity, fragile conditionals)
appears, not before.

## Commonly relevant pattern families

- **Creational** (Factory, Builder, Singleton) — useful when object
  construction itself is complex, conditional, or needs to be controlled/
  centralized. Singleton specifically should be used sparingly — it often
  introduces hidden global state and coupling.
- **Structural** (Adapter, Facade, Decorator, Composite) — useful when
  integrating incompatible interfaces (Adapter), simplifying a complex
  subsystem's exposed surface (Facade), or composing behavior without
  deep inheritance hierarchies (Decorator, Composite).
- **Behavioral** (Strategy, Observer, Command, Chain of Responsibility,
  State) — useful when behavior needs to vary independently of the object
  using it (Strategy), when multiple parts need to react to an event
  without tight coupling (Observer), or when a request needs to be
  represented as an object for queuing/undo/logging (Command).
- **Repository pattern** — useful when persistence logic needs to be
  isolated from business/application logic, especially when the
  persistence technology might change or needs to be mocked for testing.

## When NOT to apply a pattern

- When it's being added "for best practice" without a concrete problem
  it solves right now.
- When the resulting code needs more files/indirection than the logic it
  represents actually warrants — a two-branch `if` doesn't need a
  Strategy pattern.
- When it works against the coupling/cohesion goals it's meant to serve
  (e.g., an Adapter that just moves complexity around instead of
  isolating it).

## How this is used

The Solution Architect Agent references this when a component's internal
design needs a pattern-level decision. Backend and Frontend agents apply
it when implementing. The Code Reviewer Agent checks whether a pattern
was applied correctly, or whether one is missing where a real recurring
problem exists. The Refactoring Agent applies a pattern only when it
solves a real structural problem already identified — never speculatively.
