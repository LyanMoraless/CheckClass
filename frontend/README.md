# CheckClass Frontend

Minimal internal admin dashboard for institution staff (Priority 2 —
Gerenciamento da Instituição). Stack: React + TypeScript, Vite, TanStack
Query, CSS Modules — see
`.claude/skills/project-knowledge/` at the repo root for the approved
architecture/technology decisions.

## Setup local

```bash
cp .env.example .env   # only needed if the backend isn't on http://localhost:3000
npm install
npm run dev
```

Requires the backend (`../backend`) running and reachable — see
`../backend/README.md` for bringing it up (Postgres via docker compose,
migrations, `npm run start:dev`). There's no signup flow; bootstrap a
tenant + first admin account with:

```bash
cd ../backend
npm run tenant:create -- <institutionName> <institutionType> <rootFullName> <rootCpf> <rootPassword>
```

Then log in at `http://localhost:5173` with that CPF/password.

## Estrutura

- `src/features/*` — one folder per feature/page (auth, courses, rooms,
  class-groups, devices, attendance-config, attendance-register,
  pending-reviews, users, permission-groups, wristbands), each colocating
  its API calls, page component, and any feature-specific styling.
- `src/app` — route shell (nav + logout), the protected-route guard, and
  the landing page.
- `src/components` — small shared, generic UI pieces (table, modal, error
  banner, permission hint, person-id lookup field) — deliberately not a
  design system.
- `src/lib` — the typed fetch client (centralizes the `Authorization`
  header, 401 handling, and error-shape normalization) and session-token
  storage.
- `src/types/permission.ts` — mirrors the backend's `Permission` enum
  (kept in sync manually; frontend and backend are separate deployable
  units with no shared package).

## Notes

- Auth token lives in `sessionStorage` (cleared on tab close), attached via
  `Authorization: Bearer` set centrally in `src/lib/api-client.ts`. On any
  401, the session drops and the user is sent back to `/login`.
- Every screen calls `useAuth().hasPermission(...)` to disable/hide the
  actions the logged-in person can't perform, and still surfaces the
  server's 403 message if attempted anyway (permission changes elsewhere,
  or the RULE-ATT-12 leadership-chain check on resolving a pending review,
  which isn't one of the 4 general permissions).
