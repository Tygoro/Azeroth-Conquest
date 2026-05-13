import { useState, useEffect, useMemo, useRef } from 'react';
import { getClasses, getClassDetail, getTalentTree } from '@/data/static-data';
import { useTalentTree, DEFAULT_LEVEL, MIN_LEVEL, MAX_LEVEL, clampLevel, getAvailablePoints } from '@/hooks/use-talent-tree';
import { TalentTree, computeCanvasBounds } from '@/components/talent-tree';
import { SidebarTrack } from '@/components/sidebar-track';
import { ScaleStage } from '@/components/scale-stage';
import { CLASS_BG_GRADIENT } from '@/data/classes/icons';
import { SpecSelectionScreen } from '@/components/spec-selection-screen';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Share2, RefreshCcw, Download, Upload, Copy, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CLASS_COLORS, VALID_CLASS_IDS } from '@/data/classes';
import { validateAndNarrow } from '@/data/classes/validate';
import { ClassSwitcherModal } from '@/components/class-switcher-modal';
import { ClassPortrait } from '@/components/class-portrait';
import { preloadClassIcons } from '@/lib/class-icons';

// ── AE / TE hard caps (official Conquest of Azeroth) ─────────────────────────
const AE_CAP = 26;  // Ability Essence — class tree
const TE_CAP = 25;  // Talent Essence — spec tree

export default function Calculator() {
  const { toast } = useToast();

  const searchParams = new URLSearchParams(window.location.search);
  const urlData = searchParams.get('data');

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);
  const [importData, setImportData] = useState('');
  const [level, setLevel] = useState<number>(DEFAULT_LEVEL);
  const [classSwitcherOpen, setClassSwitcherOpen] = useState(false);

  // Preload class icons once on mount to prevent pop-in
  useEffect(() => { preloadClassIcons(); }, []);
  // Stable reference to the class tree data — persists across spec switches
  // so the left tree never remounts when the player changes specialization.
  const stableClassTreeRef = useRef<import('@workspace/api-client-react').TalentTree | null>(null);

  // All data is local — no API calls needed.
  const classes = useMemo(
    () => getClasses().filter(c => VALID_CLASS_IDS.has(c.id)),
    [],
  );
  const classesLoading = false;

  const classDetail = useMemo(
    () => (selectedClassId ? getClassDetail(selectedClassId) : undefined),
    [selectedClassId],
  );
  const classDetailLoading = false;
  const classDetailError = selectedClassId && !classDetail ? new Error('Class not found') : null;

  const rawTreeData = useMemo(
    () => (selectedClassId && selectedSpecId ? getTalentTree(selectedClassId, selectedSpecId) : undefined),
    [selectedClassId, selectedSpecId],
  );
  const treeLoading = false;
  const treeError = selectedClassId && selectedSpecId && !rawTreeData ? new Error('Tree not found') : null;

  // Validate the tree structure before passing it to the renderer
  const { tree: rawValidatedTree, error: treeValidationError } = useMemo(
    () => validateAndNarrow(rawTreeData),
    [rawTreeData]
  );

  // Stable class tree: once a class+spec tree loads, snapshot the LEFT tree.
  // On subsequent spec switches, reuse the snapshotted left tree so the class
  // side never remounts and class allocations survive tab changes.
  if (rawValidatedTree && rawValidatedTree.leftTree?.length) {
    if (
      !stableClassTreeRef.current ||
      stableClassTreeRef.current.classId !== rawValidatedTree.classId
    ) {
      stableClassTreeRef.current = rawValidatedTree;
    }
  }
  const stableClassTree = stableClassTreeRef.current;

  // Compose the tree: stable left side + current right side.
  const treeData = useMemo(() => {
    if (!rawValidatedTree) return undefined;
    if (!stableClassTree || stableClassTree.classId !== rawValidatedTree.classId) {
      return rawValidatedTree;
    }
    return {
      ...rawValidatedTree,
      leftTree:     stableClassTree.leftTree,
      leftTreeName: stableClassTree.leftTreeName,
    };
  }, [rawValidatedTree, stableClassTree]);

  const {
    totalPointsSpent,
    leftSpent,
    rightSpent,
    maxPoints,
    getNodeState,
    getChoiceSelection,
    addPoint,
    removePoint,
    reset,
    serializeBuild,
    setPoints,
    setChoices,
    loadBuild,
  } = useTalentTree({ treeData: treeData ?? undefined, level });

  // Restore build from URL on mount
  useEffect(() => {
    if (!urlData) return;
    try {
      const decoded = JSON.parse(atob(urlData));
      if (decoded?.classId && typeof decoded.classId === 'string' && VALID_CLASS_IDS.has(decoded.classId)) {
        setSelectedClassId(decoded.classId);
        if (decoded?.specId && typeof decoded.specId === 'string') {
          setSelectedSpecId(decoded.specId);
        }
      }
      // Restore level if present (clamped to the in-game [MIN_LEVEL, MAX_LEVEL]
      // range — older shared builds saved with a wider range collapse here).
      const decodedLevel =
        typeof decoded?.level === 'number' && Number.isFinite(decoded.level)
          ? clampLevel(decoded.level)
          : DEFAULT_LEVEL;
      setLevel(decodedLevel);

      // Sanitize points: positive finite numbers under per-entry cap.
      // Migrate legacy left-side IDs (`${classId}_${specId}_l_${i}`) to the
      // new class-stable form (`${classId}_class_l_${i}`). The regex escapes
      // classId (defensive against future IDs with regex metacharacters) and
      // uses `[^_]+` for the spec token so digits/hyphens/etc. also match.
      // It is also idempotent on already-migrated `${classId}_class_l_${i}`.
      const safe: Record<string, number> = {};
      const decodedClassId = typeof decoded?.classId === 'string' ? decoded.classId : '';
      const escapedClassId = decodedClassId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const legacyLeft = decodedClassId
        ? new RegExp(`^${escapedClassId}_[^_]+_l_(\\d+)$`)
        : null;
      if (decoded?.points && typeof decoded.points === 'object') {
        for (const [k, v] of Object.entries(decoded.points)) {
          if (typeof k === 'string' && typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 99) {
            const m = legacyLeft?.exec(k);
            const key = m ? `${decodedClassId}_class_l_${m[1]}` : k;
            safe[key] = Math.floor(v);
          }
        }
      }
      // Reject builds that exceed the level budget — never silently overspend.
      const budget = getAvailablePoints(decodedLevel);
      const totalSafe = Object.values(safe).reduce((s, n) => s + n, 0);
      if (totalSafe > budget) {
        toast({
          title: 'Invalid Build',
          description: `Build allocates ${totalSafe} points but level ${decodedLevel} only allows ${budget}.`,
          variant: 'destructive',
        });
        return;
      }
      setPoints(safe);
      if (decoded?.choices && typeof decoded.choices === 'object') {
        const safeChoices: Record<string, string> = {};
        for (const [k, v] of Object.entries(decoded.choices)) {
          if (typeof k === 'string' && typeof v === 'string' && v.length < 200) {
            safeChoices[k] = v;
          }
        }
        setChoices(safeChoices);
      }
    } catch {
      toast({ title: 'Invalid Build', description: 'The build link is corrupted.', variant: 'destructive' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlData]);

  /**
   * Predicate: a node ID belongs to the LEFT (class) tree, which is invariant
   * per class. These IDs use the literal `_class_l_` segment (vs. the
   * spec-scoped `_<specId>_r_` for right-side nodes).
   */
  const isClassNodeId = (classId: string, nodeId: string): boolean =>
    nodeId.startsWith(`${classId}_class_l_`);

  /** Keep only class-side allocations; drop spec-side allocations. */
  const filterToClassOnly = <T,>(
    map: Record<string, T>,
    classId: string,
  ): Record<string, T> => {
    const next: Record<string, T> = {};
    for (const [k, v] of Object.entries(map)) {
      if (isClassNodeId(classId, k)) next[k] = v;
    }
    return next;
  };

  const handleClassChange = (val: string) => {
    if (!VALID_CLASS_IDS.has(val)) return;
    setSelectedClassId(val);
    setSelectedSpecId(null);
    stableClassTreeRef.current = null;
    // Class change resets EVERYTHING (different class tree).
    setPoints({});
    setChoices({});
    setLevel(DEFAULT_LEVEL);
  };

  const handleSpecSelect = (specId: string) => {
    setSelectedSpecId(specId);
    // Spec change preserves class-side allocations; only spec-side state resets.
    if (selectedClassId) {
      setPoints(prev => filterToClassOnly(prev, selectedClassId));
      setChoices(prev => filterToClassOnly(prev, selectedClassId));
    }
  };

  const handleBackToSpecs = () => {
    setSelectedSpecId(null);
    // Returning to spec picker also clears spec-side state but keeps class points.
    if (selectedClassId) {
      setPoints(prev => filterToClassOnly(prev, selectedClassId));
      setChoices(prev => filterToClassOnly(prev, selectedClassId));
    }
  };

  /** Block level decrease that would invalidate the current build. */
  const handleLevelDown = () => {
    setLevel(l => {
      const next = clampLevel(l - 1);
      if (next === l) return l;
      const nextBudget = getAvailablePoints(next);
      if (totalPointsSpent > nextBudget) {
        toast({
          title: 'Cannot lower level',
          description: `Current build spends ${totalPointsSpent} points; level ${next} only allows ${nextBudget}. Refund points first.`,
          variant: 'destructive',
        });
        return l;
      }
      return next;
    });
  };

  const handleLevelUp = () => setLevel(l => clampLevel(l + 1));

  const handleCopyLink = () => {
    const built = serializeBuild();
    if (!built) return;
    const url = new URL(window.location.href);
    url.searchParams.set('data', built);
    navigator.clipboard.writeText(url.toString());
    toast({ title: 'Link Copied', description: 'Build link copied to clipboard.' });
  };

  const handleImport = () => {
    const result = loadBuild(importData.trim());
    if (result?.classId) {
      if (VALID_CLASS_IDS.has(result.classId)) {
        setSelectedClassId(result.classId);
        if (result.specId) setSelectedSpecId(result.specId);
        if (result.level !== undefined) setLevel(result.level);
        toast({ title: 'Build Imported' });
      } else {
        toast({
          title: 'Invalid Class',
          description: `"${result.classId}" is not a valid Conquest of Azeroth class.`,
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'Import Failed',
        description: 'Invalid or over-cap build string (allocates more points than its level allows).',
        variant: 'destructive',
      });
    }
  };

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const classColor = selectedClass?.color ?? CLASS_COLORS[selectedClassId ?? ''] ?? '#aaaaaa';

  // Determine main content based on selection state
  let mainContent: React.ReactNode;
  if (!selectedClassId) {
    mainContent = <EmptyState />;
  } else if (!selectedSpecId) {
    // Class chosen but no spec yet — show spec selection screen
    if (classDetailLoading) {
      mainContent = <LoadingState />;
    } else if (classDetailError || !classDetail) {
      mainContent = (
        <TreeErrorState
          classId={selectedClassId}
          message="Failed to load class specializations from the server."
        />
      );
    } else {
      mainContent = <SpecSelectionScreen classDetail={classDetail} onSelectSpec={handleSpecSelect} />;
    }
  } else if (treeLoading) {
    mainContent = <LoadingState />;
  } else if (treeError || treeValidationError) {
    mainContent = (
      <TreeErrorState
        classId={selectedClassId}
        message={treeValidationError ?? 'Failed to load talent tree data from the server.'}
      />
    );
  } else if (treeData) {
    // ── Compute intrinsic content dimensions from actual tree data ──
    const leftNodes = treeData.leftTree ?? [];
    const rightNodes = treeData.rightTree ?? [];
    const leftBounds = computeCanvasBounds(leftNodes);
    const rightBounds = computeCanvasBounds(rightNodes);
    // Gate strip width (48px each side) + gap between elements (8px each).
    const gateStripW = 48;
    const gapW = 8;
    const sidebarW = treeData.sidebarTrack?.length ? 160 : 0;
    const treeRegionW = gateStripW + leftBounds.width + gapW
                      + gateStripW + rightBounds.width + gapW
                      + sidebarW + 48; // 48px outer breathing room
    const treeLabelH = 60; // label + padding above each tree
    const treeRegionH = treeLabelH + Math.max(leftBounds.height, rightBounds.height) + 32;

    if (process.env.NODE_ENV !== 'production') {
      console.info('[Calculator] tree region intrinsic:', {
        leftCanvas: leftBounds,
        rightCanvas: rightBounds,
        totalIntrinsic: { width: treeRegionW, height: treeRegionH },
        hasSidebar: !!treeData.sidebarTrack?.length,
      });
    }

    mainContent = (
      <ScaleStage baseWidth={treeRegionW} baseHeight={treeRegionH} minScale={0.45} maxScale={1.3}>
        <div
          className="absolute inset-0"
          style={{
            display: 'grid',
            gridTemplateColumns: treeData.sidebarTrack?.length ? '42fr 42fr 16fr' : '1fr 1fr',
            alignItems: 'start',
          }}
        >
          {/* Column 1 — Class tree (left) */}
          <TalentTree
            tree={treeData}
            side="left"
            getNodeState={getNodeState}
            getChoiceSelection={getChoiceSelection}
            onNodeClick={addPoint}
            onNodeContextMenu={removePoint}
            sideSpent={leftSpent}
          />
          {/* Column 2 — Spec tree (right) */}
          <TalentTree
            tree={treeData}
            side="right"
            getNodeState={getNodeState}
            getChoiceSelection={getChoiceSelection}
            onNodeClick={addPoint}
            onNodeContextMenu={removePoint}
            sideSpent={rightSpent}
          />
          {/* Column 3 — Path of Ascension sidebar */}
          {treeData.sidebarTrack && treeData.sidebarTrack.length > 0 && (
            <SidebarTrack
              nodes={treeData.sidebarTrack}
              color={classColor}
              level={level}
            />
          )}
        </div>
      </ScaleStage>
    );
  } else {
    mainContent = <TreeErrorState classId={selectedClassId} message="No tree data returned." />;
  }

  // Show point counter only when we're in the calculator (not on spec select)
  const showPointCounter = !!treeData && !!selectedSpecId;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      {/* ── Header ── */}
      <header className="flex-none flex items-center justify-between px-5 py-3 border-b border-border bg-card z-20 shadow-lg">
        <div className="flex items-center gap-3">
          {/* App wordmark */}
          <div className="leading-none flex-shrink-0">
            <div className="text-sm font-bold tracking-widest uppercase text-primary">Conquest</div>
            <div className="text-[9px] tracking-[0.18em] text-muted-foreground uppercase">of Azeroth</div>
          </div>

          <div className="h-6 w-px bg-border" />

          {/* Class identity — icon + name + Change button */}
          {selectedClassId && selectedClass ? (
            <div className="flex items-center gap-2.5">
              <ClassPortrait
                classId={selectedClassId}
                name={selectedClass.name}
                color={classColor}
                size={34}
                glow
              />
              <div className="leading-tight">
                <div
                  className="text-[13px] font-semibold leading-none tracking-wide"
                  style={{ color: classColor, textShadow: `0 0 10px ${classColor}44` }}
                >
                  {selectedClass.name}
                </div>
                <div className="text-[8px] uppercase tracking-[0.22em] mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  Talent Calculator
                </div>
              </div>
              <button
                type="button"
                onClick={() => setClassSwitcherOpen(true)}
                className="ml-0.5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded transition-all"
                style={{
                  color: '#c8a84b',
                  borderColor: 'rgba(200,168,75,0.3)',
                  border: '1px solid rgba(200,168,75,0.3)',
                  background: 'rgba(200,168,75,0.07)',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = 'rgba(200,168,75,0.15)';
                  el.style.borderColor = 'rgba(200,168,75,0.55)';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = 'rgba(200,168,75,0.07)';
                  el.style.borderColor = 'rgba(200,168,75,0.3)';
                }}
                data-testid="button-change-class"
              >
                Change
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setClassSwitcherOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded border text-sm font-semibold transition-all"
              style={{
                color: '#c8a84b',
                borderColor: 'rgba(200,168,75,0.35)',
                background: 'rgba(200,168,75,0.06)',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = 'rgba(200,168,75,0.14)';
                el.style.borderColor = 'rgba(200,168,75,0.6)';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = 'rgba(200,168,75,0.06)';
                el.style.borderColor = 'rgba(200,168,75,0.35)';
              }}
              data-testid="button-select-class"
            >
              Choose Class
            </button>
          )}

          {/* Spec tabs — visible when class is selected */}
          {selectedClassId && classDetail?.specs && classDetail.specs.length > 0 && (
            <>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-0.5">
                {classDetail.specs.map(spec => {
                  const isActive = spec.id === selectedSpecId;
                  return (
                    <button
                      key={spec.id}
                      type="button"
                      onClick={() => handleSpecSelect(spec.id)}
                      className="px-3 h-8 text-xs font-semibold rounded transition-all"
                      style={{
                        color: isActive ? classColor : '#6a6a80',
                        background: isActive ? `${classColor}18` : 'transparent',
                        borderBottom: isActive ? `2px solid ${classColor}` : '2px solid transparent',
                      }}
                    >
                      {spec.name}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          {showPointCounter && (
            <>
              {/* Level stepper — drives availablePoints = level - 9 */}
              <div className="flex items-center gap-1.5 px-2 py-1 rounded border border-border bg-background/40">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Lvl</span>
                <button
                  type="button"
                  onClick={handleLevelDown}
                  className="w-5 h-5 flex items-center justify-center rounded text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  disabled={level <= MIN_LEVEL}
                  aria-label="Decrease level"
                  data-testid="button-level-down"
                >
                  −
                </button>
                <span
                  className="font-bold text-sm font-mono w-7 text-center"
                  style={{ color: classColor }}
                  data-testid="text-level"
                >
                  {level}
                </span>
                <button
                  type="button"
                  onClick={handleLevelUp}
                  className="w-5 h-5 flex items-center justify-center rounded text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  disabled={level >= MAX_LEVEL}
                  aria-label="Increase level"
                  data-testid="button-level-up"
                >
                  +
                </button>
              </div>

              <div className="flex items-center gap-3">
                {/* AE — class tree */}
                <div className="flex flex-col items-center gap-0.5">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">AE</div>
                  <div className="flex items-baseline gap-0.5">
                    <span
                      className="text-base font-bold font-mono leading-none"
                      style={{ color: leftSpent >= AE_CAP ? '#ff5050' : classColor }}
                      data-testid="text-class-spent"
                    >
                      {leftSpent}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 font-mono">/{AE_CAP}</span>
                  </div>
                  <div className="w-14 h-1 rounded-full overflow-hidden bg-secondary">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min((leftSpent / AE_CAP) * 100, 100)}%`,
                        background: leftSpent >= AE_CAP ? '#ff5050' : classColor,
                      }}
                    />
                  </div>
                </div>
                <div className="h-8 w-px bg-border" />
                {/* TE — spec tree */}
                <div className="flex flex-col items-center gap-0.5">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">TE</div>
                  <div className="flex items-baseline gap-0.5">
                    <span
                      className="text-base font-bold font-mono leading-none"
                      style={{ color: rightSpent >= TE_CAP ? '#ff5050' : classColor }}
                      data-testid="text-spec-spent"
                    >
                      {rightSpent}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 font-mono">/{TE_CAP}</span>
                  </div>
                  <div className="w-14 h-1 rounded-full overflow-hidden bg-secondary">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min((rightSpent / TE_CAP) * 100, 100)}%`,
                        background: rightSpent >= TE_CAP ? '#ff5050' : classColor,
                      }}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={reset}
            disabled={!treeData}
            data-testid="button-reset"
          >
            <RefreshCcw className="w-4 h-4 mr-1.5" />
            Reset
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={!treeData} data-testid="button-import-export">
                <Download className="w-4 h-4 mr-1.5" />
                Import/Export
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import / Export Build</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Export String</label>
                  <div className="flex gap-2">
                    <Textarea
                      readOnly
                      value={serializeBuild()}
                      className="font-mono text-xs h-16 resize-none"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-auto"
                      onClick={() => {
                        navigator.clipboard.writeText(serializeBuild());
                        toast({ title: 'Copied to clipboard' });
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Import String</label>
                  <Textarea
                    value={importData}
                    onChange={e => setImportData(e.target.value)}
                    placeholder="Paste build string here…"
                    className="font-mono text-xs h-16 resize-none"
                  />
                  <Button onClick={handleImport} className="w-full" data-testid="button-import">
                    <Upload className="w-4 h-4 mr-2" />
                    Import Build
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button
            variant="default"
            size="sm"
            onClick={handleCopyLink}
            disabled={!treeData}
            data-testid="button-copy-link"
          >
            <Share2 className="w-4 h-4 mr-1.5" />
            Copy Link
          </Button>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 overflow-hidden relative">
        {/* Class-themed background — sits behind the scaled stage so it covers
            the entire viewport including under the sidebar. */}
        {treeData && (
          <>
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  CLASS_BG_GRADIENT[treeData.classId] ??
                  'radial-gradient(ellipse 90% 70% at 50% 0%, #0d0d14 0%, #050508 100%)',
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'radial-gradient(ellipse 100% 80% at 50% 0%, transparent 30%, rgba(0,0,0,0.22) 100%)',
              }}
            />
          </>
        )}
        <div className="relative w-full h-full">{mainContent}</div>
      </main>

      {/* ── Class Switcher Modal ── */}
      <ClassSwitcherModal
        open={classSwitcherOpen}
        onClose={() => setClassSwitcherOpen(false)}
        classes={classes}
        selectedClassId={selectedClassId}
        onSelect={handleClassChange}
      />
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-8 gap-6">
      <div
        className="w-28 h-28 rounded-full flex items-center justify-center"
        style={{
          background: 'radial-gradient(circle, #1a1a30 0%, #0a0a14 60%)',
          border: '2px solid #2a2a4a',
          boxShadow: '0 0 40px rgba(80,60,180,0.15)',
        }}
      >
        <div
          className="w-16 h-16 rounded-full"
          style={{
            background: 'radial-gradient(circle, #2a2a50 0%, #0d0d20 100%)',
            border: '1px solid #3a3a6a',
          }}
        />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-foreground tracking-wide">Choose Your Path</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm leading-relaxed">
          Select a class above to see its specializations, then choose a spec to begin forging your build.
        </p>
      </div>

      <div className="flex gap-6 text-xs text-muted-foreground/50 font-mono mt-2">
        <span>Left-click to spend</span>
        <span>·</span>
        <span>Right-click to refund</span>
        <span>·</span>
        <span>51 total points</span>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex gap-12 justify-center py-10 px-8">
      {[0, 1].map(i => (
        <div key={i} className="flex flex-col gap-6" style={{ width: 480 }}>
          {[...Array(7)].map((_, row) => (
            <div key={row} className="flex gap-10 justify-center">
              {[...Array((row % 2 === 0 ? 3 : 4))].map((_, col) => (
                <Skeleton key={col} className="w-14 h-14 rounded-md opacity-30" />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function TreeErrorState({ classId, message }: { classId: string; message: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-8">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: '#1a0a0a', border: '2px solid #4a1a1a' }}
      >
        <AlertTriangle className="w-7 h-7 text-destructive opacity-70" />
      </div>
      <div>
        <p className="text-sm font-semibold text-destructive/80">Tree Not Available</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">{message}</p>
        <p className="text-[10px] text-muted-foreground/40 mt-3 font-mono">class: {classId}</p>
      </div>
    </div>
  );
}
