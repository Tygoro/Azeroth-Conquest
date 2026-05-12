# CoATalentExtractor — Slash Command Reference

All commands use the `/coax` prefix.

---

## /coax scan

**Captures all CoA talent node frames, including hidden and inactive nodes.**

- Requires the CoA talent window to be open.
- Traverses the full frame tree from the CoA root.
- For each `CoATalentButton*` frame: records icon, tooltip text, position, anchors,
  advancement ID, node shape/type, rank, lock state.
- For each connection/line frame: records source/target references, texture, rotation,
  strata/level.
- Runs `DiscoverTalentData` as a secondary non-visual pass.
- Appends a full capture record to `CoATalentExtractorDB.captures[]`.

**Persisted to:** `CoATalentExtractorDB.captures[]`

---

## /coax dump

**Prints a summary of the most recent capture to chat.**

- Shows: frames scanned, nodes found, hidden nodes, connections, discovery candidates.
- Does not re-scan. Uses `LAST_CAPTURE` or the last entry in `captures[]`.

---

## /coax export

**Creates an enhanced export from the latest capture + lattice data.**

Run `/coax lattice` first for full canonical coordinates.

Export structure:
- `visibleNodes[]` — nodes with valid position and lattice coordinates
- `hiddenNodes[]` — nodes shown but not visible (hidden branches)
- `pooledNodes[]` — unloaded/inactive pool frames
- `connections[]` — edge records with tree type inference
- `nodes[]` — legacy flat list (same as `visibleNodes`, for backward compatibility)

Per-node fields:
- `id`, `advancementId`, `name`, `description`, `icon`, `rank`, `visible`, `locked`
- `nodeType`, `nodeShape`, `autoGranted`
- `treeType` — `"class"` | `"spec"` | `"ascension"` | `"unknown"`
- `canonicalRow`, `canonicalCol` — deterministic 1-based lattice indices
- `anchorX`, `anchorY` — authored anchor offsets (integer)
- `localTreeX`, `localTreeY` — same as anchor offsets (tree-local coords)
- `relativeParent` — anchor relativeTo frame name
- `frameTemplate`, `frameStrata`, `frameLevel`
- `isChoice`, `choiceChildren[]`, `choiceVariantCount`
- `x`, `y` — legacy root-relative float positions

Per-connection fields:
- `id`, `treeType`, `sourceNodeFrame`, `targetNodeFrame`
- `sourceNodeId`, `targetNodeId`, `rotation`, `parentFrame`

**Persisted to:** `CoATalentExtractorDB.export`

---

## /coax discover

**Probes data providers, object pools, and non-visual node records.**

- Does not require the talent window to be open, but results are richer when it is.
- Walks `DISCOVERY_ROOT_NAMES` and recursively probes known field names for data tables,
  pools, mixins, and provider objects.
- Extracts `candidateNodes` (objects with advancement IDs, names, or type fields) and
  `candidateEdges` (objects with source/target-like fields).
- Buckets results into `classTree`, `specTree`, `ascensionTrack`, `unknown`.

**Persisted to:** `CoATalentExtractorDB.discovery[]`

---

## /coax hover

**Captures the full node record for the frame currently under the mouse.**

- Run while hovering a talent node button.
- Captures the same data as `/coax scan` for that single frame: tooltip scrape, icon,
  position relative to root, anchors, primitive fields, node shape/type.

**Persisted to:** `CoATalentExtractorDB.hover[]`

---

## /coax inspect

**Dumps complete frame topology for the hovered frame. Chat output + SavedVariables.**

Captures and prints:
- `frameName` — GetName()
- `parentName` — GetParent():GetName()
- `templateType` — GetDebugName() (proxy for template inheritance)
- `objectType` — GetObjectType()
- `frameStrata` / `frameLevel`
- `isShown` / `isVisible`
- `childCount` — GetNumChildren()
- `regionCount` — GetNumRegions()
- `dimensions` — GetWidth() × GetHeight()
- `absolutePosition` — GetLeft/GetTop/GetRight/GetBottom/center
- `relativeToRoot` — position offset from the CoA root frame
- `anchors[]` — full GetPoint() chain (point, relativeTo, relativePoint, xOfs, yOfs)
- `textures[]` — all region textures with path, type, name
- `tooltipOwnership` — OnEnter/OnLeave/OnClick presence + inferred owner reference
- `advancementId` — best CharacterAdvancementID variant found
- `nodeType` / `nodeShape`

**Persisted to:** `CoATalentExtractorDB.inspect[]`

---

## /coax lattice

**Derives deterministic canonical lattice from authored anchor offsets.**

This is the core topology extraction command. It replaces the old heuristic clustering
with exact integer-based coordinate derivation.

Algorithm:
1. Collects all `CoATalentButton*` frames from the frame tree.
2. Classifies each as `visible`, `hidden`, or `pooled`.
3. Infers tree type (`class`, `spec`, `ascension`) from anchor `relativeTo` field.
4. For each tree independently:
   - Extracts `xOfs`/`yOfs` from anchor point 1 (TOPLEFT → TOPLEFT)
   - Rounds to integer (removes sub-pixel float noise)
   - Builds unique sorted X and Y value sets
   - Assigns 1-based `canonicalRow` (from Y) and `canonicalCol` (from X)
   - Detects coordinate collisions (two nodes at same grid cell)
5. Detects choice/octagon nodes and their child variants.
6. Outputs per-tree row/col counts, occupancy, and collision warnings.

Per-tree limits: max 10 rows, max 7 columns.

Export record structure:
- `trees.class`, `trees.spec`, `trees.ascension` — independent lattice data
  - `.grid[]` — node records with `canonicalRow`, `canonicalCol`, `anchorX`, `anchorY`
  - `.rows[]`, `.cols[]` — row/column summaries with occupancy counts
  - `.uniqueX[]`, `.uniqueY[]` — the sorted canonical coordinate sets
  - `.collisions[]` — duplicate coordinate detections
- `hiddenNodes[]` — nodes not in the canonical lattice
- `pooledNodes[]` — unloaded pool frames
- `skippedReasons[]` — per-node explanations for why nodes were excluded

**Persisted to:** `CoATalentExtractorDB.lattice[]`

---

## /coax roots

**Checks all known CoA root frame names and prints found/missing + visibility.**

Root names checked:
- `CoATalentFrameTreeViewSpecTree`
- `CoATalentFrameTreeView`
- `CoATalentFrame`

---

## /coax clear

**Clears all captures, hover records, exports, discovery records, inspect records,
and lattice records from `CoATalentExtractorDB`.**

Does NOT clear `version`. A `/reload` is still required to write the cleared state.

---

## /coax debug

**Toggles verbose debug output on/off.**

When enabled, per-node discovery progress, per-frame lattice assignments, and internal
diagnostic messages are printed to chat. Default: off.

---

## /coax help

**Displays the command reference in chat with color-coded formatting.**

Also shown when running `/coax` with no arguments or an unknown subcommand.

---

## Workflow Examples

### First-time scan
```
1. Open CoA talent window
2. /coax scan
3. /reload    (writes SavedVariables)
```

### Inspect a specific node
```
1. Open CoA talent window
2. Hover over a talent node button
3. /coax inspect   (prints full topology to chat + saves)
4. /reload
```

### Derive lattice coordinates
```
1. Open CoA talent window
2. /coax lattice   (prints row/col assignments to chat + saves)
3. /reload
```

### Full diagnostic session
```
1. Open CoA talent window
2. /coax scan
3. /coax discover
4. /coax lattice
5. /coax export    (merges scan + lattice into canonical export)
6. /reload
```

### Canonical topology capture (recommended)
```
1. Open CoA talent window
2. /coax scan       (captures raw frame data)
3. /coax lattice    (derives per-tree row/col grid)
4. /coax export     (produces canonical export with lattice coords)
5. /reload          (writes SavedVariables to disk)
6. Upload: WTF/Account/<ACCOUNT>/SavedVariables/CoATalentExtractor.lua
```
