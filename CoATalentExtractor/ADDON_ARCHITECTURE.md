# CoATalentExtractor — Addon Architecture

## Overview

CoATalentExtractor is a WoW addon that attaches to the Conquest of Azeroth talent UI and
extracts frame topology, node metadata, connection topology, and lattice coordinates at
runtime. All results are persisted to `CoATalentExtractorDB` (SavedVariables) and can be
read after `/reload` or logout via the Lua dump file.

---

## File Structure

```
CoATalentExtractor/
  CoATalentExtractor.toc   -- Interface declaration, metadata, SavedVariables registration
  CoATalentExtractor.lua   -- Entire addon logic (single-file)
  README.md                -- User-facing documentation and contributor workflow
  ADDON_ARCHITECTURE.md    -- This file
  COMMANDS.md              -- Slash command reference
  FRAME_TOPOLOGY.md        -- Frame hierarchy and topology notes
  EXPORT_SCHEMA.md         -- SavedVariables schema reference
```

---

## Core Design Principles

- **Observation-only.** The addon never modifies game state.
- **pcall-wrapped everywhere.** Every frame method call is wrapped in `pcall` via `SafeCall`
  or `SafeField` to prevent addon errors from breaking the talent UI.
- **Graceful degradation.** If a frame lacks expected fields the record is still emitted
  with `nil` values rather than silently dropped.
- **Single SavedVariable.** All output tables live under `CoATalentExtractorDB`.

---

## Execution Phases

### 1. ADDON_LOADED
`EnsureDB()` is called, initialising all sub-tables. A chat message confirms the version.

### 2. /coax scan (BuildCapture)
1. Check `IsTalentUIOpen()` — exits if the talent frame is not visible.
2. `FindRootFrame()` — walks `ROOT_NAMES` to find the CoA talent frame root.
3. `TraverseFrame()` — depth-first frame tree walk, depth limit 35.
4. For each frame matching `IsTalentNodeFrame()`:
   - `CaptureNode()` — icon, tooltip scrape, position, anchors, primitive fields.
5. For each frame matching `IsConnectionFrame()`:
   - `CaptureConnection()` — source/target probing, texture, rotation, strata.
6. `DiscoverTalentData()` — field-name-driven object graph walk looking for data providers,
   pools, and candidate node/edge records.
7. Result stored in `CoATalentExtractorDB.captures[]`.

### 3. /coax discover (DiscoverTalentData)
Non-visual pass. Walks `DISCOVERY_ROOT_NAMES` and recursively probes `DISCOVERY_FIELD_NAMES`
to find data tables, pools, and provider objects that are not frame-backed.

### 4. /coax hover / /coax inspect
Both operate on `GetMouseFocus()` — the frame the cursor is currently over.
- `hover` runs the full `CaptureNode()` pipeline (tooltip scrape, icon, position).
- `inspect` runs `InspectFrame()` — deeper topology: template, strata, regions, all textures,
  anchor chain, child/region counts, tooltip script ownership.

### 5. /coax lattice (DeriveDeterministicLattice)
Extracts authored anchor offsets (`xOfs`/`yOfs`) from every talent node frame. Infers
tree type (class/spec/ascension) from anchor `relativeTo`. For each tree independently:
rounds offsets to integer, builds unique sorted X/Y sets, assigns deterministic 1-based
`canonicalRow` and `canonicalCol`. Hidden and pooled nodes are classified separately.
Choice/octagon containers are detected with their child variants. Emits to
`CoATalentExtractorDB.lattice[]`.

---

## Key Internal Functions

| Function | Purpose |
|---|---|
| `SafeCall(obj, method)` | pcall-wrapped single-argument method call |
| `SafeField(obj, key)` | pcall-wrapped table field read |
| `FindRootFrame()` | Finds CoA talent root from `ROOT_NAMES` |
| `TraverseFrame()` | Depth-first frame tree collector |
| `IsTalentNodeFrame()` | Name-pattern filter for talent button frames |
| `IsConnectionFrame()` | Name-pattern filter for connector line frames |
| `CaptureNode()` | Full node record: icon + tooltip + position + primitives |
| `CaptureConnection()` | Connection record: source/target + texture + rotation |
| `InspectFrame()` | Full frame topology: template + regions + anchors + strata |
| `DiscoverTalentData()` | Field-name-driven object graph explorer |
| `BuildDiscoverySummary()` | Aggregates discovery results into ownership buckets |
| `NormalizeNodeTypeFromObject()` | Maps shape/type fields → `active/passive/choice` |
| `InferOwnershipFromPath()` | Maps object path → `classTree/specTree/ascensionTrack` |
| `DeriveDeterministicLattice()` | Anchor-based per-tree canonical row/col derivation |
| `InferTreeType()` | Infers `class/spec/ascension` from anchor relativeTo or ancestry |
| `ClassifyNodeVisibility()` | Classifies nodes as `visible/hidden/pooled` |
| `ExtractAnchorCoords()` | Extracts integer xOfs/yOfs from frame anchor point 1 |
| `BuildUniqueSorted()` | Builds unique sorted coordinate sets for lattice indices |
| `IsChoiceNode()` | Detects choice/octagon container frames |
| `DetectChoiceChildren()` | Finds child talent buttons inside choice containers |

---

## Constants

| Constant | Value | Purpose |
|---|---|---|
| `LATTICE_MAX_ROWS` | 10 | Expected maximum rows in any single CoA tree |
| `LATTICE_MAX_COLS` | 7 | Expected maximum columns in any single CoA tree |
| `DISCOVERY_MAX_DEPTH` | 2 | Max recursion for discovery object graph |
| `DISCOVERY_MAX_OBJECTS` | 60 | Discovery result size cap |
| `DISCOVERY_MAX_FIELDS` | 24 | Max fields snapshotted per object |
| `DEBUG` | false | Enables verbose chat output (toggle: /coax debug) |

**Note:** The old `LATTICE_CLUSTER_TOLERANCE_Y/X` (28px) constants have been removed.
Lattice derivation is now deterministic — it uses exact integer anchor offsets, not
heuristic clustering.
