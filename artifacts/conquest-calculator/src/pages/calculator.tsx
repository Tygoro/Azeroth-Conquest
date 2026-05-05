import { useState, useEffect } from 'react';
import {
  useListClasses,
  useGetClass,
  getGetClassQueryKey,
} from '@workspace/api-client-react';
import { useTalentTree } from '@/hooks/use-talent-tree';
import { TalentTree } from '@/components/talent-tree';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Share2, RefreshCcw, Download, Upload, Copy } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function Calculator() {
  const { toast } = useToast();

  const searchParams = new URLSearchParams(window.location.search);
  const urlData = searchParams.get('data');

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [importData, setImportData] = useState('');

  const { data: classes, isLoading: classesLoading } = useListClasses();

  const { data: treeData, isLoading: treeLoading } = useGetClass(
    selectedClassId || '',
    { query: { enabled: !!selectedClassId, queryKey: selectedClassId ? getGetClassQueryKey(selectedClassId) : [] } }
  );

  const {
    points,
    totalPointsSpent,
    maxPoints,
    getNodeState,
    addPoint,
    removePoint,
    reset,
    serializeBuild,
    setPoints,
    loadBuild,
  } = useTalentTree({ treeData });

  // Restore build from URL on mount
  useEffect(() => {
    if (!urlData) return;
    try {
      const decoded = JSON.parse(atob(urlData));
      if (decoded?.classId) setSelectedClassId(decoded.classId);
      if (decoded?.points) setPoints(decoded.points);
    } catch {
      toast({ title: 'Invalid Build', description: 'The build link is corrupted.', variant: 'destructive' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlData]);

  const handleClassChange = (val: string) => {
    setSelectedClassId(val);
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
    const classId = loadBuild(importData);
    if (classId) {
      setSelectedClassId(classId);
      toast({ title: 'Build Imported' });
    } else {
      toast({ title: 'Import Failed', description: 'Invalid build string.', variant: 'destructive' });
    }
  };

  // Points bar fill %
  const fillPct = Math.min((totalPointsSpent / maxPoints) * 100, 100);

  const selectedClass = classes?.find(c => c.id === selectedClassId);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      {/* ── Header ── */}
      <header className="flex-none flex items-center justify-between px-5 py-3 border-b border-border bg-card z-20 shadow-lg">
        <div className="flex items-center gap-4">
          {/* Branding */}
          <div className="leading-none">
            <div className="text-lg font-bold tracking-widest uppercase text-primary">Conquest</div>
            <div className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">of Azeroth · Talent Calc</div>
          </div>

          <div className="h-6 w-px bg-border" />

          {/* Class selector */}
          <Select value={selectedClassId || ''} onValueChange={handleClassChange}>
            <SelectTrigger
              data-testid="select-class"
              className="w-52"
              disabled={classesLoading}
            >
              <SelectValue placeholder="Select Class" />
            </SelectTrigger>
            <SelectContent>
              {classes?.map(c => (
                <SelectItem key={c.id} value={c.id} data-testid={`class-option-${c.id}`}>
                  <span style={{ color: c.color }} className="font-semibold">{c.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          {/* Points counter + progress bar */}
          {treeData && (
            <div className="flex flex-col items-end gap-1">
              <div className="text-xs font-mono text-muted-foreground">
                <span className="text-primary font-bold text-sm" data-testid="points-spent">{totalPointsSpent}</span>
                <span> / {maxPoints} pts</span>
              </div>
              <div className="w-36 h-1.5 rounded-full overflow-hidden bg-secondary">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${fillPct}%`,
                    background: selectedClass
                      ? `linear-gradient(to right, ${selectedClass.color}88, ${selectedClass.color})`
                      : 'hsl(var(--primary))',
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
                    placeholder="Paste build string here..."
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
        {!selectedClassId ? (
          <EmptyState />
        ) : treeLoading ? (
          <LoadingState />
        ) : treeData ? (
          <TalentTree
            tree={treeData}
            getNodeState={getNodeState}
            onNodeClick={addPoint}
            onNodeContextMenu={removePoint}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-destructive text-sm">
            Failed to load talent tree for this class.
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-8 gap-6">
      {/* Decorative orb */}
      <div
        className="w-28 h-28 rounded-full flex items-center justify-center"
        style={{
          background: 'radial-gradient(circle, #1a1a30 0%, #0a0a14 60%)',
          border: '2px solid #2a2a4a',
          boxShadow: '0 0 40px rgba(80,60,180,0.15)',
        }}
      >
        <div className="w-16 h-16 rounded-full" style={{ background: 'radial-gradient(circle, #2a2a50 0%, #0d0d20 100%)', border: '1px solid #3a3a6a' }} />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-foreground tracking-wide">Choose Your Path</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm leading-relaxed">
          Select a class above to reveal your talent trees and begin forging your legend in the Conquest of Azeroth.
        </p>
      </div>

      <div className="flex gap-8 text-xs text-muted-foreground/60 font-mono mt-2">
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
        <div key={i} className="flex flex-col gap-4" style={{ width: 480 }}>
          {[...Array(5)].map((_, row) => (
            <div key={row} className="flex gap-8 justify-center">
              {[...Array(row % 2 === 0 ? 1 : 2)].map((_, col) => (
                <Skeleton key={col} className="w-14 h-14 rounded-md" />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
