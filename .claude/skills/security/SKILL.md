---
name: security
description: Generic security knowledge - OWASP, authentication, authorization, sessions, tokens, encryption, secrets management, input validation, common attacks, API and infrastructure security. Used primarily by the Security Agent, and referenced by every implementation agent and Code Reviewer.
---

# Security

## Purpose

Generic, technology-agnostic security knowledge. This skill doesn't know
this project's specific access rules (those live in `business-rules`
when defined by the business) — it provides the recognized practices used
to define and evaluate security requirements.

## Authentication

- Never store passwords in plain text — use a strong, purpose-built
  hashing algorithm (e.g., bcrypt, Argon2), never a general-purpose hash
  like MD5/SHA1 alone.
- Prefer well-established authentication protocols/libraries over
  custom-built authentication logic.
- Multi-factor authentication should be considered when the sensitivity
  of what's being protected justifies it.

## Authorization and access control

- Enforce authorization at every layer that matters (not just hiding a
  UI element — the backend must independently verify permission).
- Default to denying access; grant explicitly, don't block explicitly.
- Re-verify permission on every request that performs a sensitive action
  — don't rely on a decision cached from earlier in a session for
  high-stakes actions.

## Sessions and tokens

- Tokens should have a defined, reasonable expiration.
- Sensitive tokens (refresh tokens, API keys) should never be exposed to
  client-side code that doesn't need them.
- Invalidate sessions/tokens on logout and on credential change.

## Secrets management

- Secrets/credentials are never committed to version control.
- Secrets are injected via environment configuration or a secrets
  manager, never hardcoded.
- Different secrets per environment (dev/staging/production).

## Input validation

- Validate and sanitize all input that crosses a trust boundary (user
  input, external API responses, file uploads).
- Validate on the server side always — client-side validation is a UX
  convenience, never the actual security boundary.

## Common attacks to defend against

- **Injection** (SQL, command, etc.) — use parameterized queries/prepared
  statements, never string-concatenated queries with user input.
- **Cross-Site Scripting (XSS)** — escape output appropriately for its
  context; don't trust that input was already sanitized upstream.
- **Cross-Site Request Forgery (CSRF)** — use anti-CSRF tokens or
  same-site cookie policies for state-changing requests.
- **Broken access control** — the most common real-world vulnerability;
  test authorization boundaries explicitly, not just authentication.
- **Sensitive data exposure** — encrypt sensitive data at rest and in
  transit; don't log sensitive data (passwords, tokens, personal data) in
  plaintext logs.

## API security

- Rate limiting on public-facing endpoints.
- Consistent, non-revealing error responses (don't leak internal details
  or confirm/deny sensitive information through error message
  differences, e.g. in login flows).

## How this is used

The Security Agent uses this to define requirements and review
implementations. Every implementation agent references it while building
authentication/authorization/data-handling logic. The Code Reviewer Agent
uses it to check basic security adherence during review (without
redefining the security strategy itself).
