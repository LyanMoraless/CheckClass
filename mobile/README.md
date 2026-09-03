# CheckClass Mobile

Aluno (student) self-service attendance/schedule/check-in + Professor pending-review
resolution — the first mobile client for CheckClass (priority 2, institutional management).
Stack: React Native via Expo (development-build model), TypeScript, Expo Router, TanStack
Query (see `.claude/skills/project-knowledge/references/architecture-overview.md` at the repo
root for the approved architecture/technology decisions this implements).

This app deliberately covers only what's confirmed for this round: Escola/Aluno content
(attendance, schedule, check-in) plus Professor pending-review resolution. "Atividades" is
deferred — not rejected, just not this round (see `pending-decisions.md`).

There is no "Empresa" content variant and there will not be one: "empresa" was **definitively
disqualified as an institution type** on 2026-09-02, not merely deferred. The platform supports
exactly two types, `faculdade` and `escola` (`INSTITUTION_TYPES` in
`backend/src/modules/auth/tenant-bootstrap.service.ts`, enforced by RULE-INST-01).

## Setup

```bash
cp .env.example .env   # adjust EXPO_PUBLIC_API_BASE_URL per platform — see the file's comments
npm install
npm start
```

Requires the backend running (`backend/`, see its own README) and reachable from wherever the
app runs:

- iOS simulator: `http://localhost:3000` works as-is.
- Android emulator: use `http://10.0.2.2:3000` instead — `localhost` on the emulator refers to
  the emulator itself, not the host machine.
- Physical device: use the host machine's LAN IP.

This app uses the Expo **development build** model, not Expo Go (secure-storage/biometric
gating needs a dev build) — see `npx expo prebuild` / `eas build` in Expo's own docs for
generating one. `npm start` still works for iterating against an existing dev build via
Metro.

## Structure

- `src/app/` — Expo Router file-based routes (thin — each route re-exports a screen
  component from `src/features/`). Two protected groups gated by auth status
  (`src/app/_layout.tsx`, `Stack.Protected`): `login.tsx` when unauthenticated, `(app)/` (a
  tab bar) when authenticated.
- `src/features/` — one folder per feature (auth, attendance, schedule, checkin,
  pending-reviews, account), each with its API calls, screen component, and any
  feature-specific hooks colocated — same feature/page organization convention already
  confirmed for the React web dashboard (`coding-identity.md`).
- `src/lib/` — cross-cutting: `api-client.ts` (fetch wrapper: Bearer-token attachment, silent
  401 → refresh → retry, normalized error messages — mirrors
  `frontend/src/lib/api-client.ts`'s pattern, adapted to the two-token mobile auth model),
  `query-client.ts` (TanStack Query wired to NetInfo/AppState), `storage/` (expo-secure-store
  for tokens, AsyncStorage for the one pending check-in payload).
- `src/components/` — small shared UI (loading state, error banner, screen container).

## Why every authenticated user sees every tab

The backend has no role/actorType anywhere in its mobile-facing contract (the JWT payload is
just `{ personId, tenantId }`; `GET /v1/auth/me` only exposes the 4 admin permission-group
flags, unrelated to RULE-ATT-12's leadership chain). Rather than invent a role system the
backend doesn't provide, every authenticated person sees the same tab bar (Attendance,
Schedule, Check-in, Pending reviews, Account) — the backend already enforces who can actually
do what per endpoint (a student's pending-reviews list is simply always empty; resolving one
403s server-side either way per RULE-ATT-12). Flagged to the Orchestrator as a product/UX
question worth a real decision later, not decided unilaterally here.

## Testing

`npm test` runs the Jest unit suite (api-client refresh/retry/error-normalization logic,
pending-check-in local storage, check-in 422 error-message mapping). `npm run typecheck` runs
a standalone `tsc --noEmit`. There is no component/E2E test coverage yet (no simulator/device
was available in the environment this was built in) — see the Mobile Implementation Summary
for what was verified against the real backend instead.
