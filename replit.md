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
- `GET /api/classes/:classId/specs/:specId` returns the actual `TalentTree` with 40 left + 40 right nodes plus a 5-node `sidebarTrack`
- Build serialization (URL `?data=` and Import/Export) round-trips both `classId` and `specId`

### Tree layout
40-node 10-tier Dragonflight-style layout per side: rows of 3 / 4 / 5 / 5 / 5 / 5 / 5 / 4 / 3 / 1 capstone (80 nodes per spec). Mid-tree (tiers 3–6) is a dense branchy cluster with 3-prereq nodes plus span-edge reconnects in tiers 5 and 6. Node positions, prereq DAG, types and max-points all live in `artifacts/api-server/src/data/classes.ts`.

### Tier point gates (per side)
Each tier unlocks only after enough points are spent **in that tree**:

| Tier | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|------|---|---|---|---|---|---|---|---|---|---|
| Gate | 0 | 0 | 8 | 8 | 20 | 20 | 30 | 30 | 40 | 50 |

Gates are constants (`TIER_POINT_GATES`) in `hooks/use-talent-tree.ts` and rendered as a small indicator strip beside each tree (`TierGateStrip` in `components/talent-tree.tsx`).

### Path of Ascension sidebar
A right-rail vertical progression track with 5 nodes that unlock as **total points** are spent across both trees. Thresholds: `[8, 16, 24, 35, 48]`. Each costs 1 point (max 1) from the same 61-point budget. Implemented in `components/sidebar-track.tsx`. The hook returns `treeSpent` (left+right, excludes sidebar) which is what gates the sidebar — buying a sidebar node doesn't immediately satisfy the next threshold.

### Prereq logic
Multi-prereq nodes use **OR** logic — ANY one prereq being maxed unlocks the dependent (matches Dragonflight branching/reconnect feel). Refunding a maxed prereq is blocked only when no other maxed sibling prereq covers the dependent, AND only when removing wouldn't drop a higher tier below its gate.

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
