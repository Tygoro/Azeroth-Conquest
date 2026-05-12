# CoATalentExtractor — Frame Topology Notes

Observations from runtime hover/scan captures of the CoA talent UI.

---

## Known Root Frames

These global names are probed at startup and used as traversal roots:

| Frame Name | Purpose |
|---|---|
| `CoATalentFrame` | Top-level talent window |
| `CoATalentFrameTreeView` | Combined tree view container |
| `CoATalentFrameTreeViewSpecTree` | Spec (right) tree panel |
| `CoATalentFrameTreeViewClassTree` | Class (left) tree panel |
| `CoATalentFrameTreeViewClassTreePool` | Pool container for class tree buttons |
| `CoATalentFrameTreeViewSpecTreePool` | Pool container for spec tree buttons |
| `CoATalentFrameTreeViewSidebar` | Path of Ascension sidebar panel |
| `CoATalentFrameTreeViewAscension` | Ascension track container |

---

## Talent Node Button Frames

Observed template names from live captures:

- `CoATalentButtonSquareTemplate` — active/square nodes (spells, abilities)
- `CoATalentButtonCircleTemplate` — passive/circle nodes
- `CoATalentButtonOctagonTemplate` (inferred) — choice/octagon nodes

### Node Frame Detection

`IsTalentNodeFrame()` matches frames whose name contains `coatalentbutton` or
`talentbutton`, and excludes child decorators (icon, rankframe, border, shadow).

### Node Frame Fields Observed

| Field | Type | Meaning |
|---|---|---|
| `CharacterAdvancementID` | number | Primary node identity key |
| `characterAdvancementID` | number | Alternate casing variant |
| `advancementID` | number | Fallback variant |
| `nodeID` / `talentID` | number | Additional ID variants |
| `spellID` | number | Spell backing this node |
| `rank` / `currentRank` | number | Current allocated rank |
| `maxRank` | number | Maximum allocatable rank |
| `locked` / `isLocked` | boolean | Whether node is currently locked |
| `autoGranted` | boolean | Whether node is auto-granted (ascension milestones) |

### Node Shape → Type Mapping

| Frame name / shape field | Mapped type |
|---|---|
| `*square*` | `active` |
| `*circle*` / `*round*` | `passive` |
| `*oct*` / `*choice*` / `*split*` | `choice` |

---

## Connection / Connector Line Frames

Connection frames link prerequisite nodes visually. Detection via `IsConnectionFrame()`:
matches frames named containing `CALineConnectionTemplate`, `connection`, `line`, `edge`.

### Connection Frame Fields Probed

Frame references (GetName on value):
- `source`, `sourceNode`, `sourceNodeFrame`, `fromNode`, `fromFrame`, `startNode`, `parentNode`, `from`, `parent`
- `target`, `targetNode`, `targetNodeFrame`, `toNode`, `toFrame`, `endNode`, `childNode`, `to`, `child`

Primitive ID fields:
- `sourceNodeID`, `sourceNodeId`, `fromNodeID`, `fromNodeId`, `sourceID`, `sourceId`
- `targetNodeID`, `targetNodeId`, `toNodeID`, `toNodeId`, `targetID`, `targetId`

Orientation fields:
- `GetTexCoord()` — texture coordinate rotation indicates connector direction
- `GetRotation()` — explicit rotation value
- `GetFrameStrata()` / `GetFrameLevel()` — rendering order

---

## Anchor Structure

Every frame's anchor chain is captured via `GetPoint(index)` for all `GetNumPoints()`
anchors. Each anchor record contains:

```
{
  index        -- 1-based anchor number
  point        -- anchor point on this frame (e.g. "CENTER", "TOPLEFT")
  relativeTo   -- name of the frame this anchor is relative to
  relativePoint -- anchor point on the relative frame
  xOfs         -- horizontal offset in pixels
  yOfs         -- vertical offset in pixels
}
```

Anchors are the authoritative source for declarative position in the WoW frame system.
They do NOT always agree with `GetLeft/GetTop` if the frame has been repositioned at
runtime without updating anchors.

---

## Position Capture

`CapturePosition()` records:

| Field | Source |
|---|---|
| `left` | `GetLeft()` — absolute screen X of left edge |
| `right` | `GetRight()` |
| `top` | `GetTop()` — absolute screen Y of top edge (WoW Y increases downward from top) |
| `bottom` | `GetBottom()` |
| `centerX` | `(left + right) / 2` |
| `centerY` | `(top + bottom) / 2` |
| `relativeToRoot.x` | `centerX - root:GetLeft()` |
| `relativeToRoot.y` | `root:GetTop() - centerY` |
| `width` | `GetWidth()` |
| `height` | `GetHeight()` |

`relativeToRoot` values are the inputs to the lattice derivation pass.

---

## Lattice Topology

CoA talent trees are **fixed hand-authored lattice graphs**, not dynamically distributed.

Observed properties:
- Exactly **10 rows** per tree
- Maximum **7 columns** per tree
- Rows are not symmetric — occupancy varies arbitrarily per row
- Exact column occupancy matters (e.g. row may use columns 1, 3, 5 with 2, 4, 6 empty)

### Independent Tree Coordinate Systems

**Critical architecture:** Each tree panel is a separate coordinate space.

| Tree | Root Frame | Coordinate Origin |
|---|---|---|
| Class | `CoATalentFrameTreeViewClassTree` | TOPLEFT of class panel |
| Spec | `CoATalentFrameTreeViewSpecTree` | TOPLEFT of spec panel |
| Ascension | `CoATalentFrameTreeViewSidebar` | TOPLEFT of sidebar |

Nodes from different trees MUST NOT be merged into a single lattice.
The previous "more than 7 columns" warning was caused by combining class and spec
node positions into a single X value set.

### Deterministic Lattice Derivation Algorithm (`/coax lattice`)

The algorithm uses **authored anchor offsets**, not heuristic screen-position clustering.

1. Collect all `CoATalentButton*` frames from the frame tree.
2. Classify each as `visible`, `hidden`, or `pooled`.
3. Infer tree type from anchor `relativeTo` field (primary) or frame name (fallback).
4. For visible nodes with valid anchors, extract integer `xOfs`/`yOfs` from anchor point 1.
5. For each tree independently:
   - Build unique sorted X value set → column indices
   - Build unique sorted Y value set → row indices
   - Assign 1-based `canonicalRow` and `canonicalCol`
   - Detect coordinate collisions (two nodes at same grid cell)
6. Hidden and pooled nodes are exported separately, never mixed into the lattice.

This produces **identical results regardless of monitor resolution, UI scale, or frame
position** because it uses the authored anchor offsets, not screen-absolute coordinates.

### Anchor Coordinate Observations

From live captures, all talent nodes use `TOPLEFT → TOPLEFT` anchoring:

```
point = "TOPLEFT"
relativeTo = "CoATalentFrameTreeViewSpecTree"  (or ClassTree)
relativePoint = "TOPLEFT"
xOfs = 43    (authored X position)
yOfs = -263  (authored Y position, negative = downward)
```

Observed spacing increments: **~44px** between grid positions.
The `yOfs` is negative (downward from TOPLEFT); the lattice flips it to positive for
row assignment (row 1 = smallest |yOfs|).

### Row Count Examples (observed)

| Tree | Row totals (occupancy per row) |
|---|---|
| Tinker | 3, 2, 3, 3, 4, 5, 4, 3, 3, 3 |
| Invention | 1, 2, 3, 3, 4, 3, 6, 4, 3, 3 |

This confirms rows cannot be auto-centered or evenly distributed — exact column positions
must be respected.

---

## Choice Node Architecture

Choice/octagon nodes are **compound container frames**, not standard talent buttons.

- **Detection:** frame name or shape field containing `oct`, `choice`, or `split`
- **nodeType:** `"choice"`
- **nodeShape:** `"octagon"`
- **Structure:** the container frame may have child frames that are themselves talent
  buttons (the choice variants)
- **Export fields:** `isChoice`, `choiceChildren[]` (frame names of child variants),
  `choiceVariantCount`

Choice nodes occupy a single lattice cell. Their child variants share the parent's
canonical `(row, col)` position. The renderer should display these as a single
interactive slot with variant selection, not as multiple grid cells.

---

## Tooltip Ownership

Talent nodes expose talent tooltip data via `OnEnter` script handlers that call
`GameTooltip:SetOwner` and populate the global tooltip. The addon scrapes lines via
`GameTooltip:NumLines()` and `_G[tooltipName .. "TextLeft" .. i]`.

`/coax inspect` also probes `frame.tooltipOwner`, `frame.tooltip`, `frame.GameTooltip`
for explicit reference storage (not all frames set these).

---

## TalentSpecTreePoolFrame

A pool frame (`CoATalentFrameTreeViewSpecTreePool` / `ClassTreePool`) manages reuse of
talent button frames. Under it:
- `activeObjects` — currently visible/active node buttons
- `inactiveObjects` — pooled/inactive node buttons

The discovery pass (`/coax discover`) probes these via `DISCOVERY_FIELD_NAMES` to find
nodes that may not be visible in the current frame tree walk.
