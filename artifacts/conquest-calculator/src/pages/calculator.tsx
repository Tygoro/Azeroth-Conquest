import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { 
  useListClasses, 
  useGetClass, 
  getGetClassQueryKey,
  useSaveBuild, 
  useGetBuild 
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
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Extract potential build data from URL
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
    setPoints
  } = useTalentTree({ treeData });

  // Handle URL loading on mount
  useEffect(() => {
    if (urlData) {
      try {
        const decoded = JSON.parse(atob(urlData));
        if (decoded.classId) {
          setSelectedClassId(decoded.classId);
          if (decoded.points) {
            setPoints(decoded.points);
          }
        }
      } catch (e) {
        toast({
          title: "Invalid Build Data",
          description: "The build link provided is invalid or corrupted.",
          variant: "destructive"
        });
      }
    }
  }, [urlData, toast, setPoints]);

  const handleCopyLink = () => {
    const buildString = serializeBuild();
    if (!buildString) return;
    
    const url = new URL(window.location.href);
    url.searchParams.set('data', buildString);
    
    navigator.clipboard.writeText(url.toString());
    toast({
      title: "Link Copied",
      description: "Build link copied to clipboard.",
    });
  };

  const handleImport = () => {
    try {
      const decoded = JSON.parse(atob(importData));
      if (decoded.classId) {
        setSelectedClassId(decoded.classId);
        if (decoded.points) {
          setPoints(decoded.points);
        }
        toast({ title: "Build imported successfully" });
      }
    } catch (e) {
      toast({
        title: "Import Failed",
        description: "Invalid build string.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      {/* Header */}
      <header className="flex-none flex items-center justify-between p-4 border-b border-border bg-card z-10 shadow-md">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-serif font-bold text-primary tracking-wider uppercase">
            Ascension
            <span className="text-muted-foreground text-sm block lowercase tracking-normal">Talent Calculator</span>
          </h1>
          
          <div className="w-64">
            <Select 
              value={selectedClassId || ''} 
              onValueChange={(val) => {
                setSelectedClassId(val);
                reset();
              }}
            >
              <SelectTrigger disabled={classesLoading}>
                <SelectValue placeholder="Select Class" />
              </SelectTrigger>
              <SelectContent>
                {classes?.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center gap-2">
                      {c.icon && <img src={c.icon} alt="" className="w-5 h-5 rounded" />}
                      <span style={{ color: c.color }}>{c.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {treeData && (
            <div className="text-sm font-mono bg-background px-3 py-1.5 rounded border border-border shadow-inner">
              Points: <span className="text-primary font-bold">{totalPointsSpent}</span> / {maxPoints}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={reset} disabled={!treeData}>
              <RefreshCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={!treeData}>
                  <Download className="w-4 h-4 mr-2" />
                  Import/Export
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import / Export Build</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Export String</label>
                    <div className="flex gap-2">
                      <Textarea readOnly value={serializeBuild() || ''} className="font-mono text-xs h-20" />
                      <Button variant="secondary" className="h-auto" onClick={() => {
                        navigator.clipboard.writeText(serializeBuild() || '');
                        toast({ title: 'Copied to clipboard' });
                      }}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Import String</label>
                    <Textarea 
                      value={importData} 
                      onChange={e => setImportData(e.target.value)} 
                      placeholder="Paste build string here..."
                      className="font-mono text-xs h-20"
                    />
                    <Button onClick={handleImport} className="w-full">
                      <Upload className="w-4 h-4 mr-2" />
                      Import Build
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button variant="default" size="sm" onClick={handleCopyLink} disabled={!treeData}>
              <Share2 className="w-4 h-4 mr-2" />
              Copy Link
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative p-4">
        {!selectedClassId ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <div className="w-24 h-24 mb-6 rounded-full bg-muted border-2 border-border/50 flex items-center justify-center shadow-inner">
              <span className="text-4xl opacity-50">?</span>
            </div>
            <h2 className="text-2xl font-serif text-foreground">Select a Class</h2>
            <p className="mt-2 text-sm max-w-md text-center">
              Choose your hero path above to begin allocating talents and forging your legend in the Conquest of Azeroth.
            </p>
          </div>
        ) : treeLoading ? (
          <div className="h-full flex items-center justify-center">
            <Skeleton className="w-full h-full rounded-lg" />
          </div>
        ) : treeData ? (
          <TalentTree 
            tree={treeData}
            getNodeState={getNodeState}
            onNodeClick={addPoint}
            onNodeContextMenu={removePoint}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-destructive">
            Failed to load talent tree.
          </div>
        )}
      </main>
    </div>
  );
}
