/**
 * Manual edge routing overrides.
 *
 * The auto-router handles straight vertical/horizontal lines and basic L-elbows
 * correctly, but some connections in the authored Ascension trees use non-standard
 * routing (diagonal approaches, multi-knee elbows, side-face exits, etc.).
 *
 * This file lets you pin the exact routing for any connection without touching
 * the general algorithm. All fields are optional — only override what you need.
 *
 * Key:  "<fromNodeId>-><toNodeId>"  (prereq → dependent, not visual direction)
 *
 * Routing types:
 *   "auto"    — use the automatic L-elbow (default, no need to specify)
 *   "manual"  — use a fully custom SVG `path` string (absolute coords)
 *   "elbow"   — force L-elbow but with explicit exit/enter sides and optional midY
 *   "straight" — force straight line between the two specified faces
 *
 * Face values:  "top" | "bottom" | "left" | "right"
 *
 * Usage:
 *   In talent-tree.tsx, call getEdgeOverride(prereqId, nodeId) before edgePath().
 *   If an override exists with routing:"manual" + path, return it directly.
 *   If routing:"elbow" + sides, use those instead of auto-detecting from pixel coords.
 */

export type EdgeFace = 'top' | 'bottom' | 'left' | 'right';

export type EdgeRoutingType = 'auto' | 'elbow' | 'straight' | 'manual';

export interface EdgeOverride {
  /** Overrides the routing type. Defaults to "auto". */
  routing?: EdgeRoutingType;
  /** Face to exit the prerequisite (from) node. */
  exit?: EdgeFace;
  /** Face to enter the dependent (to) node. */
  enter?: EdgeFace;
  /**
   * Y-coordinate of the horizontal rail for elbow routing.
   * In canvas-local pixels (before any scaling). Optional — auto if omitted.
   */
  midY?: number;
  /**
   * Fully custom SVG path string.
   * Only used when routing === "manual".
   * Coords are in canvas-local pixels (same space as node positions).
   */
  path?: string;
  /**
   * Optional array of intermediate waypoints for multi-knee routes.
   * Each waypoint is an absolute canvas-local { x, y } point the path must pass through.
   */
  waypoints?: { x: number; y: number }[];
}

/**
 * Per-class per-spec edge override table.
 * Outer key: class slug (e.g. "tinker")
 * Inner key: "<prereqNodeId>-><dependentNodeId>"
 */
// ── Node ID aliases for readability ──────────────────────────────────────────
// Full CoATalentFrameTreeView* IDs are verbose. We alias them here so overrides
// below are human-readable. All aliases expand to the full canonical frame ID.

// Tinker spec tree
const T = {
  // ── Col-10 sidebar track (autoGranted milestones) ──
  StimAugmentation:      'CoATalentFrameTreeViewSpecTreePoolFrameCoATalentButtonSquareTemplate1',
  ScientificNature:      'CoATalentFrameTreeViewSpecTreePoolFrameCoATalentButtonCircleTemplate26',
  BeaconCharging:        'CoATalentFrameTreeViewSpecTreePoolFrameCoATalentButtonSquareTemplate11',
  Graftbolts:            'CoATalentFrameTreeViewSpecTreePoolFrameCoATalentButtonCircleTemplate27',
  ImprovedGraftbolts:    'CoATalentFrameTreeViewSpecTreePoolFrameCoATalentButtonCircleTemplate28',
  // ── Spec tree nodes with rowSpan > 1 or notable elbow issues ──
  HealingRadiator:       'CoATalentFrameTreeViewSpecTreePoolFrameCoATalentButtonCircleTemplate8',
  MacroDesigner:         'CoATalentFrameTreeViewSpecTreePoolFrameCoATalentButtonCircleTemplate5',
  OverRepaired:          'CoATalentFrameTreeViewSpecTreePoolFrameCoATalentButtonCircleTemplate2',
  Eureka:                'CoATalentFrameTreeViewSpecTreePoolFrameCoATalentButtonCircleTemplate7',
  FieldMedic:            'CoATalentFrameTreeViewSpecTreePoolFrameCoATalentButtonCircleTemplate6',
  BatteryRechargeStation:'CoATalentFrameTreeViewSpecTreePoolFrameCoATalentButtonSquareTemplate8',
  StimPack:              'CoATalentFrameTreeViewSpecTreePoolFrameCoATalentButtonCircleTemplate10',
  Zap:                   'CoATalentFrameTreeViewSpecTreePoolFrameCoATalentButtonSquareTemplate7',
  BuildRestorative:      'CoATalentFrameTreeViewSpecTreePoolFrameCoATalentButtonSquareTemplate3',
};

// Tinker class tree
const C = {
  // ── Row-1 nodes (anchorY = -1 in source data, off-canvas) ──
  RocketBoots:           'CoATalentFrameTreeViewClassTreePoolFrameCoATalentButtonSquareTemplate5',
  BuildDestructoBot:     'CoATalentFrameTreeViewClassTreePoolFrameCoATalentButtonSquareTemplate3',
  NanobotReconstruction: 'CoATalentFrameTreeViewClassTreePoolFrameCoATalentButtonSquareTemplate4',
  // ── Row-2 targets of row-1 sources ──
  ExplosivePersonality:  'CoATalentFrameTreeViewClassTreePoolFrameCoATalentButtonCircleTemplate2',
  RefinedGunpowder:      'CoATalentFrameTreeViewClassTreePoolFrameCoATalentButtonCircleTemplate3',
  // ── Row-3 targets of row-1 sources (2-row down elbows) ──
  BackupFuel:            'CoATalentFrameTreeViewClassTreePoolFrameCoATalentButtonCircleTemplate5',
  HastyTech:             'CoATalentFrameTreeViewClassTreePoolFrameCoATalentButtonCircleTemplate6',
  // ── Mid-tree 2-row skip verticals ──
  KineticShield:         'CoATalentFrameTreeViewClassTreePoolFrameCoATalentButtonSquareTemplate8',
  Mechanosoldier:        'CoATalentFrameTreeViewClassTreePoolFrameCoATalentButtonCircleTemplate10',
  BuildRepulsionUnit:    'CoATalentFrameTreeViewClassTreePoolFrameCoATalentButtonSquareTemplate6',
  BunkerOperative:       'CoATalentFrameTreeViewClassTreePoolFrameCoATalentButtonCircleTemplate24',
  BuildAlarmBeacon:      'CoATalentFrameTreeViewClassTreePoolFrameCoATalentButtonSquareTemplate7',
  Scrapshielding:        'CoATalentFrameTreeViewClassTreePoolFrameCoATalentButtonCircleTemplate25',
};

// Key convention: "<prereqId>-><childId>"
// prereq = LOWER canonicalRow (closer to row 1, top of screen)
// child  = HIGHER canonicalRow (further from row 1, bottom of screen)
// Visual flow: prereq exits its BOTTOM face → child enters its TOP face (downward)
// For elbows that cross columns: exit bottom + enter top still applies for
// nodes where prereq is above child in the grid.

const EDGE_OVERRIDES: Record<string, Record<string, EdgeOverride>> = {
  // ── Tinker ──────────────────────────────────────────────────────────────────
  tinker: {

    // ── SIDEBAR TRACK: col-10 vertical chain ─────────────────────────────────
    // prereq=lower-row(top), child=higher-row(bottom); flow is downward.
    // 2-row spans skip an odd row → force straight to avoid floating midY rails.
    //   r1→r3: StimAugmentation(prereq) → ScientificNature(child)
    [`${T.StimAugmentation}->${T.ScientificNature}`]:    { routing: 'straight', exit: 'bottom', enter: 'top' },
    //   r3→r5: ScientificNature(prereq) → BeaconCharging(child)
    [`${T.ScientificNature}->${T.BeaconCharging}`]:      { routing: 'straight', exit: 'bottom', enter: 'top' },
    //   r5→r7: BeaconCharging(prereq) → Graftbolts(child)
    [`${T.BeaconCharging}->${T.Graftbolts}`]:            { routing: 'straight', exit: 'bottom', enter: 'top' },
    //   r7→r9: Graftbolts(prereq) → ImprovedGraftbolts(child)
    [`${T.Graftbolts}->${T.ImprovedGraftbolts}`]:        { routing: 'straight', exit: 'bottom', enter: 'top' },

    // ── SPEC TREE: 2-row-span same-column verticals ───────────────────────────
    // MacroDesigner[r4c2](prereq) → HealingRadiator[r6c2](child): skips row 5
    [`${T.MacroDesigner}->${T.HealingRadiator}`]:        { routing: 'straight', exit: 'bottom', enter: 'top' },
    // Eureka[r4c8](prereq) → Zap[r6c8](child): skips row 5
    [`${T.Eureka}->${T.Zap}`]:                           { routing: 'straight', exit: 'bottom', enter: 'top' },
    // StimPack[r5c4](prereq) → BatteryRechargeStation[r7c4](child): skips row 6
    [`${T.StimPack}->${T.BatteryRechargeStation}`]:      { routing: 'straight', exit: 'bottom', enter: 'top' },

    // ── SPEC TREE: 2-row-span cross-column elbows ────────────────────────────
    // FieldMedic[r2c7](prereq) → Eureka[r4c8](child): down-right, different columns
    [`${T.FieldMedic}->${T.Eureka}`]:                    { routing: 'elbow', exit: 'bottom', enter: 'top' },
    // OverRepaired[r2c3](prereq) → MacroDesigner[r4c2](child): down-left, different columns
    [`${T.OverRepaired}->${T.MacroDesigner}`]:            { routing: 'elbow', exit: 'bottom', enter: 'top' },

    // ── CLASS TREE: row-1 sources (anchorY=-1 → off top of canvas) ───────────
    // RocketBoots[r1c3](prereq) → BackupFuel[r3c2](child): down-left elbow, exit bottom
    [`${C.RocketBoots}->${C.BackupFuel}`]:               { routing: 'elbow', exit: 'bottom', enter: 'top' },
    // NanobotReconstruction[r1c7](prereq) → HastyTech[r3c8](child): down-right elbow, exit bottom
    [`${C.NanobotReconstruction}->${C.HastyTech}`]:      { routing: 'elbow', exit: 'bottom', enter: 'top' },

    // ── CLASS TREE: 2-row-span same-column verticals ──────────────────────────
    // KineticShield[r6c5](prereq) → Mechanosoldier[r8c5](child): skips row 7
    [`${C.KineticShield}->${C.Mechanosoldier}`]:         { routing: 'straight', exit: 'bottom', enter: 'top' },
    // BuildRepulsionUnit[r7c2](prereq) → BunkerOperative[r9c2](child): skips row 8
    [`${C.BuildRepulsionUnit}->${C.BunkerOperative}`]:   { routing: 'straight', exit: 'bottom', enter: 'top' },
    // BuildAlarmBeacon[r7c8](prereq) → Scrapshielding[r9c8](child): skips row 8
    [`${C.BuildAlarmBeacon}->${C.Scrapshielding}`]:       { routing: 'straight', exit: 'bottom', enter: 'top' },
  },
};

/**
 * Look up an edge override for a given prereq→dependent pair.
 * Returns undefined if no override is registered (use auto-routing).
 */
export function getEdgeOverride(
  classSlug: string,
  fromId: string,
  toId: string,
): EdgeOverride | undefined {
  const classOverrides = EDGE_OVERRIDES[classSlug];
  if (!classOverrides) return undefined;
  return classOverrides[`${fromId}->${toId}`];
}
