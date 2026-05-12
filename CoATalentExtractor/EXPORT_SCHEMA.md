# CoATalentExtractor — SavedVariables Export Schema

All output is stored under a single SavedVariable: `CoATalentExtractorDB`

---

## Top-Level Structure

```lua
CoATalentExtractorDB = {
  version   = 5,           -- Schema version
  captures  = {},          -- Array of full scan capture records
  hover     = {},          -- Array of single-frame hover captures
  inspect   = {},          -- Array of /coax inspect frame topology dumps
  export    = {},          -- Latest simplified flat node export
  discovery = {},          -- Array of /coax discover data-provider records
  lattice   = {},          -- Array of /coax lattice row/col derivation records
}
```

---

## captures[] — Full Scan Record

Appended by `/coax scan`. Each entry:

```lua
{
  capturedAt              = "YYYY-MM-DD HH:MM:SS",
  addonVersion            = "1.0.0",
  rootName                = "CoATalentFrameTreeViewSpecTree",  -- which root was found
  rootVisible             = true,
  totalFramesScanned      = 142,
  nodesFound              = 38,
  hiddenNodesFound        = 4,
  iconSuccessCount        = 34,
  connectionCount         = 12,
  discoveryObjectCount    = 47,
  discoveryCandidateNodeCount = 22,
  discoveryCandidateEdgeCount = 8,
  discoverySummary        = { ... },   -- see Discovery Summary below
  classTree               = { ... },   -- candidate nodes bucketed to classTree
  specTree                = { ... },   -- candidate nodes bucketed to specTree
  ascensionTrack          = { ... },   -- candidate nodes bucketed to ascensionTrack
  unknownDiscoveryNodes   = { ... },   -- unclassified discovery candidates
  nodes                   = { ... },   -- array of Node Records (see below)
  connections             = { ... },   -- array of Connection Records (see below)
  discovery               = { ... },   -- raw DiscoverTalentData output
}
```

---

## Node Record

Each entry in `captures[].nodes[]`:

```lua
{
  frameName    = "CoATalentButton1",
  objectType   = "Button",
  isShown      = true,
  isVisible    = true,
  dimensions   = { width = 48, height = 48 },
  position     = {
    left = 412.5, right = 460.5, top = 610.0, bottom = 562.0,
    centerX = 436.5, centerY = 586.0,
    relativeToRoot = { x = 124.0, y = 40.0 },
    width = 48, height = 48,
  },
  anchors      = {
    { index = 1, point = "CENTER", relativeTo = "CoATalentFrameTreeView",
      relativePoint = "TOPLEFT", xOfs = 124.0, yOfs = -40.0 },
  },
  iconTexture    = "Interface\\Icons\\Spell_Fire_Fireball",
  iconSource     = "region",       -- "field" | "named-child" | "region" | "child"
  iconSourceName = "CoATalentButton1Icon",
  tooltipHandlers = { hasOnEnter = true, hasOnLeave = true, hasOnClick = true },
  tooltip = {
    attempted = true,
    success   = true,
    lines     = {
      { index = 1, left = "Fireball", right = nil },
      { index = 2, left = "Rank 1/5", right = nil },
      { index = 3, left = "Hurls a fiery ball that causes 40 Fire damage.", right = nil },
    },
  },
  primitiveFields = {
    CharacterAdvancementID = 10042,
    rank = 1,
    maxRank = 5,
    locked = false,
  },
  treeType     = "spec",            -- "class" | "spec" | "ascension" | "unknown"
  nodeShape    = "square",          -- "square" | "circle" | "octagon" | nil
  nodeType     = "active",          -- "active" | "passive" | "choice" | nil
  autoGranted  = false,
  advancementId = 10042,
  parsedName   = "Fireball",
  parsedDescription = "Hurls a fiery ball that causes 40 Fire damage.",
  parsedRank   = "Rank 1/5",
  locked       = false,
}
```

---

## Connection Record

Each entry in `captures[].connections[]`:

```lua
{
  frameName        = "CoATalentLineConnection1",
  objectType       = "Frame",
  isShown          = true,
  isVisible        = true,
  position         = { ... },   -- same structure as Node position
  anchors          = { ... },   -- same structure as Node anchors
  primitiveFields  = { ... },
  parentFrame      = "CoATalentFrameTreeView",
  sourceNodeFrame  = "CoATalentButton1",   -- nil if not found via frame ref
  targetNodeFrame  = "CoATalentButton2",   -- nil if not found via frame ref
  sourceNodeId     = 10042,                -- nil if not found via ID field
  targetNodeId     = 10043,                -- nil if not found via ID field
  frameStrata      = "MEDIUM",
  frameLevel       = 4,
  texCoords        = { 0, 1, 0, 1, 0, 1, 0, 1 },  -- raw GetTexCoord output
  rotation         = 1.5707,               -- radians, nil if not set
  textures         = {                     -- regions on the connection frame
    { index = 1, regionType = "Texture", name = nil, texture = "Interface\\TalentFrame\\CoALineH" },
  },
}
```

---

## inspect[] — Frame Topology Record

Appended by `/coax inspect`. Each entry:

```lua
{
  capturedAt = "YYYY-MM-DD HH:MM:SS",
  frame = {
    frameName        = "CoATalentButton1",
    parentName       = "CoATalentFrameTreeViewClassTreePool",
    templateType     = "CoATalentButtonSquareTemplate",   -- via GetDebugName
    objectType       = "Button",
    frameStrata      = "MEDIUM",
    frameLevel       = 5,
    isShown          = true,
    isVisible        = true,
    childCount       = 4,
    regionCount      = 3,
    dimensions       = { width = 48, height = 48 },
    absolutePosition = {
      left = 412.5, right = 460.5, top = 610.0, bottom = 562.0,
      centerX = 436.5, centerY = 586.0,
      relativeToRoot = { x = 124.0, y = 40.0 },
      width = 48, height = 48,
    },
    anchors = {
      { index = 1, point = "CENTER", relativeTo = "CoATalentFrameTreeView",
        relativePoint = "TOPLEFT", xOfs = 124.0, yOfs = -40.0 },
    },
    textures = {
      { index = 1, regionType = "Texture", name = nil,
        texture = "Interface\\Icons\\Spell_Fire_Fireball" },
      { index = 2, regionType = "Texture", name = "CoATalentButton1Border",
        texture = "Interface\\TalentFrame\\CoANodeBorderSquare" },
    },
    tooltipOwnership = {
      hasOnEnter    = true,
      hasOnLeave    = true,
      hasOnClick    = true,
      inferredOwner = nil,
    },
    primitiveFields = { CharacterAdvancementID = 10042, rank = 1, maxRank = 5 },
    nodeShape        = "square",
    nodeType         = "active",
    advancementId    = 10042,
  }
}
```

---

## lattice[] — Deterministic Lattice Derivation Record

Appended by `/coax lattice`. Uses deterministic anchor-based derivation, NOT heuristic
clustering. Each tree (class, spec, ascension) maintains its own independent coordinate
system and lattice grid.

```lua
{
  capturedAt       = "YYYY-MM-DD HH:MM:SS",
  addonVersion     = "1.0.0",
  visibleNodeCount = 35,
  hiddenNodeCount  = 4,
  pooledNodeCount  = 0,
  skippedReasons   = { "SomeFrame: visible but missing anchor data" },
  trees = {
    class = { ... },      -- see Tree Lattice below
    spec  = { ... },      -- see Tree Lattice below
    ascension = { ... },  -- see Tree Lattice below (may be nil)
  },
  hiddenNodes = { ... },  -- array of node records without lattice coords
  pooledNodes = { ... },  -- array of unloaded pool frame records
}
```

### Tree Lattice (per tree)

```lua
{
  treeType  = "spec",
  nodeCount = 28,
  rowCount  = 10,
  colCount  = 5,
  uniqueX   = { 14, 58, 102, 146, 190 },        -- sorted authored X anchor offsets
  uniqueY   = { 14, 58, 102, 146, 190, ... },    -- sorted authored Y anchor offsets
  rows = {
    { rowIndex = 1, anchorY = 14,  nodeCount = 3 },
    { rowIndex = 2, anchorY = 58,  nodeCount = 5 },
    -- ...
  },
  cols = {
    { colIndex = 1, anchorX = 14,  nodeCount = 4 },
    { colIndex = 2, anchorX = 58,  nodeCount = 6 },
    -- ...
  },
  grid = {
    {
      frameName      = "CoATalentFrameTreeViewSpecTreePoolFrameCoATalentButtonSquareTemplate1",
      treeType       = "spec",
      anchorX        = 454,
      anchorY        = 14,
      localTreeX     = 454,
      localTreeY     = 14,
      canonicalRow   = 1,
      canonicalCol   = 5,
      relativeParent = "CoATalentFrameTreeViewSpecTree",
      nodeShape      = "square",
      nodeType       = "active",
      isChoice       = false,
      choiceChildren = nil,
      advancementId  = 4050,
      visibility     = "visible",
      frameTemplate  = "...",
      frameStrata    = "MEDIUM",
      frameLevel     = 5,
      dimensions     = { width = 30, height = 30 },
      primitiveFields = { ... },
    },
    -- ...
  },
  collisions = {},  -- duplicate coordinate detections (should be empty)
}
```

`canonicalRow` and `canonicalCol` are 1-based. Empty lattice slots are simply absent
from `grid[]`. Coordinates are deterministic integer values from authored anchor offsets,
not screen-relative floats.

---

## export — Enhanced Canonical Export

Written by `/coax export` (overwrites, not appended). Merges capture data with lattice
data for authoritative topology output. Run `/coax lattice` before exporting.

```lua
CoATalentExtractorDB.export = {
  exportedAt        = "YYYY-MM-DD HH:MM:SS",
  sourceCaptureAt   = "YYYY-MM-DD HH:MM:SS",
  hasLattice        = true,
  visibleNodes = {
    {
      id              = "CoATalentFrameTreeViewSpecTreePoolFrameCoATalentButtonSquareTemplate1",
      advancementId   = 4050,
      name            = "Stim Augmentation",
      description     = "...",
      icon            = "interface\\talentframe\\talents",
      rank            = "Rank 1/1",
      visible         = true,
      locked          = false,
      nodeType        = "active",
      nodeShape       = "square",
      autoGranted     = false,
      treeType        = "spec",
      -- Deterministic lattice coordinates
      canonicalRow    = 1,
      canonicalCol    = 5,
      anchorX         = 454,
      anchorY         = 14,
      localTreeX      = 454,
      localTreeY      = 14,
      relativeParent  = "CoATalentFrameTreeViewSpecTree",
      -- Frame metadata
      frameTemplate   = "...",
      frameStrata     = "MEDIUM",
      frameLevel      = 5,
      -- Choice node fields (nil for non-choice)
      isChoice        = false,
      choiceChildren  = nil,
      choiceVariantCount = nil,
      -- Legacy position (backward compatibility)
      x               = 454.0,
      y               = 14.0,
    },
    -- ...
  },
  hiddenNodes  = { ... },  -- same structure, nodes not shown/visible
  pooledNodes  = { ... },  -- same structure, nodes without anchor data
  connections  = {
    {
      id              = "...CALineConnectionTemplate1",
      treeType        = "spec",
      sourceNodeFrame = "CoATalentButton1",
      targetNodeFrame = "CoATalentButton2",
      sourceNodeId    = 10042,
      targetNodeId    = 10043,
      rotation        = 1.5707,
      parentFrame     = "CoATalentFrameTreeViewSpecTree",
    },
    -- ...
  },
  -- Legacy flat list (same reference as visibleNodes)
  nodes = { ... },
}
```

---

## discovery[] — Data Provider Discovery Record

Appended by `/coax discover`. Each entry contains:

```lua
{
  capturedAt  = "YYYY-MM-DD HH:MM:SS",
  status      = "complete",   -- "started" | "complete" | "error"
  roots       = { ... },      -- which DISCOVERY_ROOT_NAMES were found
  objects     = { ... },      -- raw SnapshotObject records
  candidateNodes = { ... },   -- ExtractCandidateNodeRecord results
  candidateEdges = { ... },   -- ExtractCandidateEdgeRecord results
  providerNames  = { ... },   -- paths to discovered data provider tables
  progress    = {
    visited = 47, candidateErrors = 0, edgeErrors = 0,
    rootErrors = 0, maxDepthReached = 2,
  },
  summary     = { ... },      -- BuildDiscoverySummary output
  classTree   = { ... },
  specTree    = { ... },
  ascensionTrack = { ... },
  unknownNodes   = { ... },
}
```

---

## hover[] — Hover Capture Record

Appended by `/coax hover`. Each entry:

```lua
{
  capturedAt = "YYYY-MM-DD HH:MM:SS",
  node       = { ... },   -- full Node Record (same structure as captures[].nodes[])
}
```
