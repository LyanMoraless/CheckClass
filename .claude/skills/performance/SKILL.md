---
name: performance
description: Generic knowledge of profiling, bottleneck identification, latency, throughput, scalability, and optimization technique. Used by the Performance Agent, always grounded in actual measurement rather than assumption.
---

# Performance

## Purpose

Generic performance-engineering knowledge — how to find where a real
bottleneck is, and how to think about the trade-offs of fixing it. This
skill exists to support measurement-driven optimization, never
speculative optimization.

## Core principle

**Measure before optimizing, and measure after.** A bottleneck that
"seems obvious" is often not where the actual time/resources go. Profile
or otherwise gather concrete evidence before deciding what to change, and
confirm the fix actually improved the measured metric — don't assume it
did.

## Where bottlenecks commonly hide

- **Backend**: slow database queries (especially N+1 patterns），
  unnecessary synchronous waiting on I/O, inefficient algorithms on
  larger-than-expected data, missing caching where it would genuinely
  help.
- **Frontend**: excessive re-rendering, large unoptimized assets/bundle
  size, blocking synchronous work on the main thread, unnecessary network
  waterfalls (sequential requests that could be parallel).
- **Database**: missing indexes for the actual query pattern, poor query
  structure, lock contention under concurrency, inefficient
  joins/queries against large tables.
- **Devices**: constrained processing/memory being pushed beyond
  capacity, inefficient polling instead of event-driven updates, power
  consumption from unnecessarily frequent operations.

## Key metrics

- **Latency** — time for a single operation to complete, end to end.
- **Throughput** — how many operations the system handles per unit time.
- **Resource consumption** — CPU, memory, network, energy (for devices).
- **Scalability** — how latency/throughput/resource consumption change as
  load or data volume grows; a system can be fast at current scale and
  degrade badly at 10x.

## Optimization techniques (apply only where measurement justifies them)

- Caching — introduces a correctness trade-off (staleness); the trade-off
  must be stated explicitly, not hidden.
- Indexing — see `database-engineering` for specifics.
- Batching/reducing round-trips — combining multiple small operations
  into fewer larger ones when the overhead is per-call, not per-unit-of-
  work.
- Async/parallel processing — when operations don't have a real
  dependency on each other's completion order.
- Reducing work done, not just doing the same work faster — sometimes the
  fastest fix is determining a computation doesn't need to happen at all
  for a given case.

## Trade-offs to always make explicit

- Performance vs. correctness (staleness from caching).
- Performance vs. readability/maintainability — a heavily optimized,
  hard-to-read version needs to justify its complexity cost.
- Performance vs. cost — throwing more infrastructure at a problem is a
  valid trade-off sometimes, but it's a trade-off, not a free win.

## How this is used

The Performance Agent applies this only when invoked on a concrete,
reported or measured symptom (see `performance.md` — this agent is
reactive, not part of every delivery flow), always following the
measure → optimize → re-measure cycle.
