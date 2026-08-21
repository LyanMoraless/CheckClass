---
name: database-engineering
description: Generic technical knowledge for data modeling, SQL, indexes, constraints, transactions, migrations, triggers, procedures, and optimization. Used by the Database Agent, independent of any specific database engine.
---

# Database Engineering

## Purpose

Generic, engine-agnostic database engineering knowledge. Specific SQL
dialect or engine features come from the technology already approved in
`project-knowledge` plus that engine's own documentation.

## Modeling

- Entities and relationships should faithfully reflect the business
  rules involved — a relationship's cardinality (one-to-many,
  many-to-many) should match what `business-rules`/`business-domain`
  actually specify, not a convenient simplification.
- Normalize by default; denormalize only with an explicit, justified
  performance reason — not as a starting default.

## Relationships and referential integrity

- Foreign key constraints enforce relationships at the database level
  rather than relying solely on application-level checks.
- Decide cascade behavior (on delete/update) deliberately based on the
  actual business meaning of the relationship, not the engine's default.

## Constraints

- Push integrity rules that must always hold (uniqueness, required
  fields, valid ranges) down to the database level where practical — the
  database is the last line of defense against inconsistent data, even
  if the application also validates.

## Indexes

- Index based on actual query patterns (what's filtered/sorted/joined on
  frequently), not preemptively on every column.
- Be aware indexes have a write-performance cost — don't over-index.

## Transactions

- Wrap operations that must succeed or fail together in a transaction.
- Understand the isolation level implications relevant to the use case
  (e.g., whether concurrent reads during a write can see intermediate
  state).

## Migrations

- Every migration should be reversible where at all possible.
- Migrations should be safe to run against production data, not just
  against an empty schema — consider what happens to existing rows.
- Never edit a migration that has already been applied elsewhere; write
  a new migration instead.

## Procedures and triggers

- Use only when justified by a real need (e.g., an integrity rule that
  genuinely can't be enforced any other way, or a performance-critical
  operation that must run at the database level) — not as a default
  pattern, since they move logic out of version-controlled application
  code and are harder to test.

## Performance

- Understand and use `EXPLAIN`/execution plans (or the engine's
  equivalent) before assuming where a slow query's bottleneck is.
- Consider query patterns holistically — an individually fast query
  called in a loop (N+1) is still a real bottleneck.

## How this is used

The Database Agent applies this while modeling and implementing, alongside
`business-rules` (targeted consultation), `security` (data protection),
and `performance` (when optimization is the specific task).
