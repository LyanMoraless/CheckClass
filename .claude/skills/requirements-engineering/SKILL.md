---
name: requirements-engineering
description: Generic, reusable methods for eliciting, analyzing, decomposing, and specifying requirements, writing acceptance criteria, identifying ambiguities, and assessing the impact of a change. Used primarily by the Business Analyst Agent when turning a request into structured, unambiguous analysis.
---

# Requirements Engineering

## Purpose

This skill provides the **method**, not the content — it doesn't know
anything about this specific project's requirements; it defines how to
approach analyzing any requirement well. Project-specific content
produced using these methods lives in the Business Analyst's outputs and,
once confirmed, in `business-domain` / `business-rules`.

## Elicitation

- Start from what was actually said, not what seems implied.
- Separate what the requester explicitly stated from what you're
  inferring — inferences must be flagged as such, not presented as fact.
- Ask about the actor's goal, not just the requested feature — the same
  goal sometimes has a simpler solution than the one literally requested.

## Analysis and decomposition

- Break a request into the smallest independently verifiable pieces.
- Separate functional requirements (what the system does) from
  non-functional ones (performance, security, availability — these route
  to specialist agents, not into the functional analysis itself).
- Identify actors: who initiates, who is affected, who approves, who is
  notified.
- Identify flows: the main path, and realistic alternate paths.
- Identify exceptions: what can go wrong, and what should happen when it
  does.

## Specification

- Write requirements so a different person (or agent) reading them later,
  without the original conversation's context, would implement the same
  thing.
- Avoid ambiguous qualifiers ("fast", "simple", "user-friendly") without
  a concrete, checkable definition attached.

## Acceptance criteria

- Objective and verifiable — a criterion should have a clear pass/fail
  answer, not require judgment.
- Cover the main flow, meaningful alternate flows, and known exceptions.
- Written so the QA Agent can validate against them directly, without
  needing to re-interpret intent.

## Identifying ambiguities

A requirement is ambiguous when it can reasonably be implemented two
different ways that would satisfy the literal wording but produce
different behavior. When found:

- Name the specific ambiguity (not "this is unclear" — say what the two
  readings are).
- Don't resolve it by picking the reading that seems "more likely" —
  flag it for confirmation.

## Impact analysis

- What existing behavior, data, or components does this change touch?
- What could break that isn't obviously related to the request?
- Is this an extension of existing behavior, or does it contradict
  something already established (in `business-rules` or
  `project-knowledge`)?

## How this is used

The Business Analyst Agent applies these methods when producing its
Requirements Analysis output. The Product Definition Agent applies the
elicitation and ambiguity-identification parts when producing the Product
Understanding Brief.
