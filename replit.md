# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

Hosts the **Conquest of Azeroth Talent Calculator** — a Dragonflight-style talent calculator for the Ascension WoW custom server's 21 CoA classes.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Talent Calculator Architecture

### Class → Spec → Tree flow
- `GET /api/classes` returns 21 class metas
- `GET /api/classes/:classId` returns `ClassDetail` with `specs[]` (3–4 SpecMeta per class)
- `GET /api/classes/:classId/specs/:specId` returns the actual `TalentTree` with 22 left + 22 right nodes
- Build serialization (URL `?data=` and Import/Export) round-trips both `classId` and `specId`

### Tree layout
22-node hex/diamond layout per side: rows of 3 / 4 / 5 / 4 / 3 / 2 / 1 capstone, with prereq edges connecting each node to the 1–2 above it. Node positions and prereq matrix live in `artifacts/api-server/src/data/classes.ts`.

### Spec data
- **Sun Cleric** has 4 hand-crafted specs (Piety / Valkyrie / Seraphim / Blessings) matching the in-game UI
- All other classes have 3 procedurally generated specs (Path of Wrath / Bulwark / Mastery) with class-themed talent names driven by `CLASS_FLAVORS` (damage type, signature spells, capstone names per class)
- Talent names are produced from spec themes (signature names at the top, capstone at the bottom, procedural in between)

### Frontend
- `artifacts/conquest-calculator` (React + Vite)
- `pages/calculator.tsx` orchestrates class select → spec select → tree
- `components/spec-selection-screen.tsx` — 3-or-4-column responsive grid of spec cards
- `components/talent-tree.tsx` — auto-sizes to node positions, supports the 22-node layout
- `hooks/use-talent-tree.ts` — point allocation logic + serialization including specId

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
