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
10-tier Dragonflight-style layout per side. The default row pattern is `[1,3,4,5,5,4,4,3,2,2]` = 33 nodes. **Per-spec overrides** live in `artifacts/api-server/src/data/tree-rows.ts` via the `TREE_ROWS` map (e.g. `suncleric_valkyrie_l: [3,2,3,3,4,5,5,4,3,3]`, `suncleric_valkyrie_r: [1,1,2,4,3,7,5,4,3,3]`) — both sides must always have exactly 10 rows. `generateLayout(rows)` builds positions, types, max-points and a nearest-neighbor prereq DAG; the default rows return a frozen layout that exactly matches the original hand-tuned data so existing serialized URLs keep working. Node IDs are stable (`${prefix}_${idx+1}`).

The frontend `SingleTree` (`components/talent-tree.tsx`) groups nodes by tier (using `TIER_Y_VALUES` from the hook) and renders each row as `flex justify-center` with `gap`, so wide rows naturally make the container wider without horizontal scroll. SVG connection lines use refs + `useLayoutEffect` + `ResizeObserver` to read each node's center relative to the container — endpoints stay correct under responsive scaling.

### Tier point gates (per side)
Each tier unlocks only after enough points are spent **in that tree**. Gates start at row 4:

| Tier | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|------|---|---|---|---|---|---|---|---|---|---|
| Gate | 0 | 0 | 0 | 0 | 8 | 8 | 20 | 20 | 30 | 40 |

Gates are constants (`TIER_POINT_GATES`) in `hooks/use-talent-tree.ts` and rendered as a small indicator strip beside each tree (`TierGateStrip` in `components/talent-tree.tsx`).

### Choice nodes
Some talents (~6 per side) are **choice nodes** with two mutually exclusive options. They cost 1 point and `maxPoints = 1`. Clicking spends a point and selects option A; clicking again cycles to option B; right-click refunds. The chosen option is persisted in build serialization under `choices`. Visually rendered as a horizontal split-octagon — each half shows one option's icon, with a glowing divider and the active half highlighted. The tooltip lists both options (A/B badges) with descriptions and marks the selected one.

### Path of Ascension sidebar
A right-rail vertical progression track with 5 nodes that **auto-unlock** as **total tree points** (left + right, excluding sidebar) cross the thresholds `[10, 20, 30, 40, 50]`. Sidebar nodes are **not clickable** and **cost no points** — they are pure milestone rewards. Implemented in `components/sidebar-track.tsx` as a read-only display.

### Prereq logic
All prereqs use **AND** logic — every listed prereq must have at least 1 point allocated for the dependent to unlock. Refunding a point is blocked when removing it would orphan any direct dependent that still has points, or when it would drop a higher tier below its gate.

### Spec data
- **Sun Cleric** has 4 hand-crafted specs (Piety / Valkyrie / Seraphim / Blessings) matching the in-game UI
- All other classes have 3 procedurally generated specs (Path of Wrath / Bulwark / Mastery) with class-themed talent names driven by `CLASS_FLAVORS` (damage type, signature spells, capstone names per class)
- Talent names are produced from spec themes (signature names at the top, capstone at the bottom, procedural in between)

### Frontend
- `artifacts/conquest-calculator` (React + Vite)
- `pages/calculator.tsx` orchestrates class select → spec select → tree; owns the class-themed background layers and wraps the tree+sidebar in `ScaleStage`
- `components/spec-selection-screen.tsx` — 3-or-4-column responsive grid of spec cards
- `components/scale-stage.tsx` — game-UI-style centered scaling wrapper. Children render at fixed logical dimensions (1280×820); container uses `ResizeObserver` to compute `scale = clamp(min(W/base, H/base), minScale, maxScale)` and applies `transform: translate(-50%,-50%) scale(s)`. Result: no scrollbars, sidebar always visible, smooth shrink on small screens.
- `components/talent-tree.tsx` — auto-sizes to node positions, supports the 33-node layout, choice-node split icon. Node shapes by type: passive=circle, active=rounded square, capstone=circle, choice=octagon (clip-path). Tooltip uses `useLayoutEffect` + `getBoundingClientRect` to flip top↔bottom and nudge horizontally to stay inside the viewport.
- `hooks/use-talent-tree.ts` — point allocation logic, AND-prereq enforcement, choice cycling, serialization including specId + choices

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
