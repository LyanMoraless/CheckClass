---
name: devops
description: Generic knowledge of CI/CD, containers, environments, deployment, configuration, logs, monitoring, observability, and rollback. Used by the DevOps Agent, independent of any specific cloud provider or tooling.
---

# DevOps

## Purpose

Generic infrastructure and delivery knowledge — independent of which
specific cloud provider, CI platform, or container orchestrator the
project uses (that's determined by `project-knowledge` / Tech Decision).

## CI/CD

- Every code change should pass through automated build + test before
  being deployable — deploying something that skipped the pipeline is a
  red flag, not a shortcut.
- Pipeline stages should fail fast — cheap/fast checks (lint, unit tests)
  before expensive/slow ones (integration tests, deployment).
- Keep the pipeline itself version-controlled and reviewable like any
  other code.

## Containers

- Images should be built reproducibly — the same source should always
  produce a functionally equivalent image.
- Keep images minimal — only what's needed to run, not build tooling left
  behind in a production image.
- Don't bake environment-specific configuration into the image itself —
  inject it at runtime (see Configuration below).

## Environments

- Environments (dev/staging/production or equivalent) should be as
  similar as practical in structure, differing mainly in scale and
  configuration values — divergence between environments is a common
  source of "works in staging, breaks in production."

## Deployment

- Deployments should be repeatable — the same deployment process used
  every time, not manual one-off steps for "this particular release."
- Prefer deployment strategies that allow a safe way back (see Rollback)
  over irreversible, all-at-once cutovers when the risk profile justifies
  it.

## Configuration and secrets

- Configuration varies per environment; secrets are never committed to
  version control, injected via environment variables or a secrets
  manager instead.
- The same secret should differ across environments (a leaked staging
  credential shouldn't compromise production).

## Logs

- Structured, consistent log format across services, so logs from
  different components can be correlated.
- Log enough to debug an issue after the fact, without logging sensitive
  data (see `security`).

## Monitoring and observability

- Monitor for both availability (is it up) and health (is it behaving
  correctly) — a service can be "up" and still failing silently.
- Metrics and traces should make it possible to find *where* in a
  distributed flow a problem originates, not just *that* something is
  wrong.

## Rollback

- Every deployment should have a known, tested way to revert if something
  goes wrong — this is verified *before* finalizing a deployment, not
  figured out reactively during an incident.
- Database migrations deployed alongside code need a rollback story too,
  not just the application code.

## How this is used

The DevOps Agent applies this while implementing pipelines, environments,
and deployments, always confirming rollback capability exists before
considering a deployment task complete.
