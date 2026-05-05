# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

Hosts the **Conquest of Azeroth Talent Calculator** — a Dragonflight-style talent calculator for the Ascension WoW custom server's 21 CoA classes (Sun Cleric, Necromancer, Pyromancer, Cultist, Starcaller, Tinker, Runemaster, Primalist, Reaper, Venomancer, Chronomancer, Bloodmage, Guardian, Stormbringer, Felsworn, Barbarian, Witch Doctor, Witch Hunter, Knight of Xoroth, Ranger, Templar).

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
- `GET /api/classes/:classId/specs/:specId` returns the actual `TalentTree` with a class-invariant `leftTree` plus a spec-specific `rightTree` and `sidebarTrack`
- Build serialization (URL `?data=` and Import/Export) round-trips both `classId` and `specId`

### Class-invariant LEFT tree
The LEFT (class) tree is **byte-identical** across every spec of a given class. This is enforced server-side: a single canonical class-side config (from the class's first spec) is used to build the left tree, the result is cached + deep-frozen per `classId`, and node IDs use the literal `class` token (`${classId}_class_l_${idx}`) instead of the spec id. The right tree keeps spec-scoped IDs (`${classId}_${specId}_r_${idx}`).

Client-side this means:
- **Spec change** purges only allocations whose IDs do NOT start with `${classId}_class_l_` — class-side points and choices persist into the new spec.
- **Class change** still resets everything (different class tree).
- **Legacy URL builds** (which used `${classId}_${specId}_l_${idx}` for left nodes) are auto-migrated to the new IDs at load time so older shared links continue to work.
- The hook deep-freezes `leftTree`/`rightTree`/`sidebarTrack` in dev mode as a defense-in-depth guard against accidental mutation.

### Tree layout
10-tier Dragonflight-style layout per side. The default row pattern is `[1,3,4,5,5,4,4,3,2,2]` = 33 nodes. **Per-spec overrides** live in `artifacts/api-server/src/data/tree-rows.ts` via the `TREE_ROWS` map (e.g. `suncleric_valkyrie_l: [3,2,3,3,4,5,5,4,3,3]`, `suncleric_valkyrie_r: [1,1,2,4,3,7,5,4,3,3]`) — both sides must always have exactly 10 rows. `generateLayout(rows)` builds positions, types, max-points and a nearest-neighbor prereq DAG; the default rows return a frozen layout that exactly matches the original hand-tuned data so existing serialized URLs keep working. Node IDs are stable (`${prefix}_${idx+1}`).

The frontend `SingleTree` (`components/talent-tree.tsx`) groups nodes by tier (using `TIER_Y_VALUES` from the hook) and renders each row as `flex justify-center` with `gap`, so wide rows naturally make the container wider without horizontal scroll. SVG connection lines use refs + `useLayoutEffect` + `ResizeObserver` to read each node's center relative to the container — endpoints stay correct under responsive scaling.

### Tier point gates (per side)
Each tier unlocks only after enough points are spent **in that tree** (left or right, sidebar excluded). Gates use a linear WoW-style progression starting at row 5:

| Row  | 1 | 2 | 3 | 4 | 5 | 6  | 7  | 8  | 9  | 10 |
|------|---|---|---|---|---|----|----|----|----|----|
| Gate | 0 | 0 | 0 | 0 | 8 | 16 | 24 | 32 | 40 | 48 |

`ROW_UNLOCKS` (1-indexed) is the canonical map; `TIER_POINT_GATES` (0-indexed flat array) is the runtime form used by `getNodeState`. Both live in `hooks/use-talent-tree.ts`. The gate strip renders only the non-zero rows beside each tree (`TierGateStrip`). Locked rows are visually dimmed in `SingleTree` via row-level `opacity: 0.78` (combined with per-node 0.35 → effective ~0.27, dim but readable).

### Level-driven point budget (WoW progression)
The total points a player can spend is driven by character level:

```
getAvailablePoints(level) = max(0, level - 9)
```

Level 10 = 1 point, level 60 = 51 points (Ascension max). The legal range is `[MIN_LEVEL=10, MAX_LEVEL=60]` and `DEFAULT_LEVEL = MAX_LEVEL = 60`, so a fresh load shows `Points: 0 / 51`. The hook accepts a `level` prop and computes `maxPoints = min(getAvailablePoints(level), treeData.maxPoints)`. `addPoint` and choice-node clicks both check `canAllocateMore = totalSpent < maxPoints`. Level changes go through `clampLevel` (the single source of truth for the legal range), and old shared builds saved at level > 60 collapse to 60 on import.

**UI**: Header shows a `LVL [−] N [+]` stepper (clamped to [10, 60]; − disables at 10, + disables at 60), `Points: X / Y` bar, and a per-tree breakdown `Class: X · Spec: Y` (sidebar nodes auto-unlock and don't count).

**Cap invariant** is enforced at every entry point:
- Click allocation: blocked when `totalSpent >= maxPoints`
- Level decrease: blocked with toast when current spend exceeds the new level's budget (user must refund first)
- URL load: build is rejected with toast if encoded points exceed the level budget
- Import: same validation; `loadBuild` returns `undefined` on over-cap input
- Class/spec change: resets level to `DEFAULT_LEVEL` along with points/choices

**Serialization** (`serializeBuild`) now includes `level` so build links preserve the budget context; `loadBuild` restores it (defaulting to `DEFAULT_LEVEL` for backward compatibility with older links).

### Choice nodes
Some talents (~6 per side) are **choice nodes** with two mutually exclusive options. They cost 1 point and `maxPoints = 1`. Clicking spends a point and selects option A; clicking again cycles to option B; right-click refunds. The chosen option is persisted in build serialization under `choices`. Visually rendered as a horizontal split-octagon — each half shows one option's icon, with a glowing divider and the active half highlighted. The tooltip lists both options (A/B badges) with descriptions and marks the selected one.

### Path of Ascension sidebar
A right-rail vertical progression track with 5 nodes that **auto-unlock** as **total tree points** (class + spec, sidebar excluded) cross the thresholds `[0, 10, 20, 30, 40]` — so the first node is **free at spec selection** and the remaining 4 unlock every 10 total points spent. Sidebar nodes are **not clickable** and **cost no points** — they are pure milestone rewards. Unlock is tied ONLY to total points spent, NOT to character level and NOT to per-tree spend. Implemented in `components/sidebar-track.tsx` as a read-only display; locked-node tooltip shows "Unlocks at X total points".

### Prereq logic
All prereqs use **AND** logic — every listed prereq must have at least 1 point allocated for the dependent to unlock. Refunding a point is blocked when removing it would orphan any direct dependent that still has points, or when it would drop a higher tier below its gate.

### Spec data
- A single uniform metadata table (`CLASS_FLAVORS` in `artifacts/api-server/src/data/classes.ts`) defines each class's left-tree theme and the full per-spec list (id, name, role, attribute, complexity, description, capstone, theme tokens) — modeled after the in-game CoA "Combat Style" data.
- All 21 classes (Sun Cleric, Necromancer, Pyromancer, Cultist, Starcaller, Tinker, Runemaster, Primalist, Reaper, Venomancer, Chronomancer, Bloodmage, Guardian, Stormbringer, Felsworn, Barbarian, Witch Doctor, Witch Hunter, Knight of Xoroth, Ranger, Templar) flow through the same `autoBuildSpecsForClass` pipeline — no class-specific special-casing.
- Spec counts vary by class (3 or 4 specs) just like the in-game UI; `SpecSelectionScreen` renders the API response dynamically with a 3- or 4-column grid and an empty-state fallback when a class has no specs.
- Talent names are produced from spec themes (signature names at the top, capstone at the bottom, procedural in between).

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
