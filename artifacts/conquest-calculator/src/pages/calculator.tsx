import { useState, useEffect, useMemo } from 'react';
import {
  useListClasses,
  useGetClass,
  useGetSpecTree,
  getGetClassQueryKey,
  getGetSpecTreeQueryKey,
} from '@workspace/api-client-react';
import { useTalentTree } from '@/hooks/use-talent-tree';
import { TalentTree } from '@/components/talent-tree';
import { SidebarTrack } from '@/components/sidebar-track';
import { SpecSelectionScreen } from '@/components/spec-selection-screen';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Share2, RefreshCcw, Download, Upload, Copy, AlertTriangle, ChevronLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CLASSES, CLASS_IDS, CLASS_COLORS, VALID_CLASS_IDS } from '@/data/classes';
import { validateAndNarrow } from '@/data/classes/validate';

// Fallback class list — used while API hasn't loaded.
const FALLBACK_CLASSES = CLASSES.map(name => ({
  id: CLASS_IDS[name],
  name,
  color: CLASS_COLORS[CLASS_IDS[name]] ?? '#aaaaaa',
  description: '',
  icon: '',
}));

export default function Calculator() {
  const { toast } = useToast();

  const searchParams = new URLSearchParams(window.location.search);
  const urlData = searchParams.get('data');

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);
  const [importData, setImportData] = useState('');

  const { data: apiClasses, isLoading: classesLoading } = useListClasses();

  // Filter out invalid IDs (e.g. stale cache)
  const classes = useMemo(() => {
    const source = apiClasses ?? FALLBACK_CLASSES;
    return source.filter(c => VALID_CLASS_IDS.has(c.id));
  }, [apiClasses]);

  // Fetch class detail (with specs) when class is selected
  const { data: classDetail, isLoading: classDetailLoading, error: classDetailError } = useGetClass(
    selectedClassId || '',
    {
      query: {
        enabled: !!selectedClassId,
        queryKey: selectedClassId ? getGetClassQueryKey(selectedClassId) : [],
      },
    },
  );

  // Fetch spec tree when both class and spec are selected
  const { data: rawTreeData, isLoading: treeLoading, error: treeError } = useGetSpecTree(
    selectedClassId || '',
    selectedSpecId || '',
    {
      query: {
        enabled: !!selectedClassId && !!selectedSpecId,
        queryKey: selectedClassId && selectedSpecId
          ? getGetSpecTreeQueryKey(selectedClassId, selectedSpecId)
          : [],
      },
    },
  );

  // Validate the tree structure before passing it to the renderer
  const { tree: treeData, error: treeValidationError } = useMemo(
    () => validateAndNarrow(rawTreeData),
    [rawTreeData]
  );

  const {
    totalPointsSpent,
    treeSpent,
    leftSpent,
    rightSpent,
    maxPoints,
    getNodeState,
    addPoint,
    removePoint,
    reset,
    serializeBuild,
    setPoints,
    loadBuild,
  } = useTalentTree({ treeData: treeData ?? undefined });

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
      // Sanitize points: only accept positive finite numbers under a sane cap.
      if (decoded?.points && typeof decoded.points === 'object') {
        const safe: Record<string, number> = {};
        for (const [k, v] of Object.entries(decoded.points)) {
          if (typeof k === 'string' && typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 99) {
            safe[k] = Math.floor(v);
          }
        }
        setPoints(safe);
      }
    } catch {
      toast({ title: 'Invalid Build', description: 'The build link is corrupted.', variant: 'destructive' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlData]);

  const handleClassChange = (val: string) => {
    if (!VALID_CLASS_IDS.has(val)) return;
    setSelectedClassId(val);
    setSelectedSpecId(null);
    setPoints({});
  };

  const handleSpecSelect = (specId: string) => {
    setSelectedSpecId(specId);
    setPoints({});
  };

  const handleBackToSpecs = () => {
    setSelectedSpecId(null);
    setPoints({});
  };

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
        toast({ title: 'Build Imported' });
      } else {
        toast({
          title: 'Invalid Class',
          description: `"${result.classId}" is not a valid Conquest of Azeroth class.`,
          variant: 'destructive',
        });
      }
    } else {
      toast({ title: 'Import Failed', description: 'Invalid build string.', variant: 'destructive' });
    }
  };

  const fillPct = Math.min((totalPointsSpent / maxPoints) * 100, 100);
  const selectedClass = classes.find(c => c.id === selectedClassId);
  const classColor = selectedClass?.color ?? CLASS_COLORS[selectedClassId ?? ''] ?? '#aaaaaa';
  const selectedSpec = classDetail?.specs?.find(s => s.id === selectedSpecId);

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
    mainContent = (
      <div className="flex h-full">
        <div className="flex-1 min-w-0 overflow-auto">
          <TalentTree
            tree={treeData}
            getNodeState={getNodeState}
            onNodeClick={addPoint}
            onNodeContextMenu={removePoint}
            leftSpent={leftSpent}
            rightSpent={rightSpent}
          />
        </div>
        {treeData.sidebarTrack && treeData.sidebarTrack.length > 0 && (
          <SidebarTrack
            nodes={treeData.sidebarTrack}
            color={classColor}
            treeSpent={treeSpent}
            getNodeState={getNodeState}
            onNodeClick={addPoint}
            onNodeContextMenu={removePoint}
          />
        )}
      </div>
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
        <div className="flex items-center gap-4">
          <div className="leading-none">
            <div className="text-lg font-bold tracking-widest uppercase text-primary">Conquest</div>
            <div className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">of Azeroth · Talent Calc</div>
          </div>

          <div className="h-6 w-px bg-border" />

          {/* Class selector */}
          <Select value={selectedClassId || ''} onValueChange={handleClassChange}>
            <SelectTrigger
              data-testid="select-class"
              className="w-56"
              disabled={classesLoading && classes.length === 0}
            >
              <SelectValue placeholder={classesLoading ? 'Loading classes…' : 'Select Class'} />
            </SelectTrigger>
            <SelectContent>
              {classes.map(c => (
                <SelectItem key={c.id} value={c.id} data-testid={`class-option-${c.id}`}>
                  <span style={{ color: c.color }} className="font-semibold">{c.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Spec breadcrumb / back when spec selected */}
          {selectedSpecId && selectedSpec && (
            <>
              <div className="h-6 w-px bg-border" />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToSpecs}
                data-testid="button-back-to-specs"
                className="gap-1 text-xs h-8"
                style={{ color: classColor }}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                {selectedSpec.name}
              </Button>
            </>
          )}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          {showPointCounter && (
            <div className="flex flex-col items-end gap-1">
              <div className="text-xs font-mono text-muted-foreground">
                <span className="font-bold text-sm" style={{ color: classColor }} data-testid="points-spent">
                  {totalPointsSpent}
                </span>
                <span> / {maxPoints} pts</span>
              </div>
              <div className="w-36 h-1.5 rounded-full overflow-hidden bg-secondary">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${fillPct}%`,
                    background: `linear-gradient(to right, ${classColor}88, ${classColor})`,
                  }}
                />
              </div>
            </div>
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
      <main className="flex-1 overflow-auto relative">
        {mainContent}
      </main>
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
        <span>61 total points</span>
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
