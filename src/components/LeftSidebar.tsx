import { useSimulationStore, Protocol, InteractionMode } from '@/store/simulationStore';
import { runTransaction } from '@/hooks/useTwoPhaseCommitSimulation';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Plus, Link, Skull, Zap, Timer, Play, Pause, RotateCcw, Send } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useState } from 'react';
import { ProtocolGuideDrawer } from './ProtocolGuideDrawer';
import { ScenariosModal } from './ScenariosModal';

const protocols: { value: Protocol; label: string }[] = [
  { value: 'raft', label: 'Raft Consensus' },
  { value: 'gossip', label: 'Gossip Protocol' },
  { value: 'consistent-hashing', label: 'Consistent Hashing' },
  { value: 'vector-clocks', label: 'Vector Clocks' },
  { value: '2pc', label: 'Two-Phase Commit' },
];

export function LeftSidebar() {
  const {
    protocol, setProtocol, addNode, interactionMode, setInteractionMode,
    running, toggleRunning, reset, speed, setSpeed, tpcPhase,
  } = useSimulationStore();

  return (
    <div className="w-60 min-w-[240px] bg-card border-r border-border flex flex-col h-full overflow-y-auto scrollbar-thin">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <h1 className="font-mono text-xl font-bold text-primary tracking-wider">
          DistSim
        </h1>
        <p className="text-xs text-muted-foreground font-outfit mt-0.5">
          Distributed Systems Lab
        </p>
      </div>

      <div className="p-4 space-y-4 flex-1">
        {/* Protocol */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Protocol</label>
            <ProtocolGuideDrawer />
          </div>
          <Select value={protocol} onValueChange={(v) => setProtocol(v as Protocol)}>
            <SelectTrigger className="bg-surface border-border font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {protocols.map(p => (
                <SelectItem key={p.value} value={p.value} className="font-mono text-xs">
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Node Controls */}
        <div className="space-y-2">
          <ScenariosModal />
          <Button
            onClick={addNode}
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 font-mono text-xs border-border bg-surface hover:bg-accent"
          >
            <Plus className="w-3.5 h-3.5" /> Add Node
          </Button>
          {protocol === '2pc' && (
            <Button
              onClick={() => runTransaction(() => useSimulationStore.getState())}
              variant="outline"
              size="sm"
              disabled={tpcPhase !== 'idle'}
              className={`w-full justify-start gap-2 font-mono text-xs border-border bg-surface hover:bg-success/10 hover:text-success ${
                tpcPhase !== 'idle' ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Send className="w-3.5 h-3.5" /> {tpcPhase === 'idle' ? 'Begin Transaction' : tpcPhase === 'prepare' ? 'PREPARE...' : tpcPhase === 'commit' ? 'COMMITTED' : tpcPhase === 'abort' ? 'ABORTED' : 'BLOCKED'}
            </Button>
          )}
          <Button
            onClick={() => setInteractionMode('connect')}
            variant="outline"
            size="sm"
            className={`w-full justify-start gap-2 font-mono text-xs border-border bg-surface hover:bg-accent ${
              interactionMode === 'connect' ? 'ring-1 ring-primary text-primary' : ''
            }`}
          >
            <Link className="w-3.5 h-3.5" /> Connect Nodes
          </Button>
        </div>

        {/* Fault Injection */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Separator className="flex-1 bg-border" />
            <span className="text-[10px] font-mono text-muted-foreground tracking-widest">FAULT INJECTION</span>
            <Separator className="flex-1 bg-border" />
          </div>
          <div className="space-y-2">
            <Button
              onClick={() => setInteractionMode('kill')}
              variant="outline"
              size="sm"
              className={`w-full justify-start gap-2 font-mono text-xs border-border bg-surface hover:bg-destructive/10 hover:text-destructive ${
                interactionMode === 'kill' ? 'ring-1 ring-destructive text-destructive' : ''
              }`}
            >
              <Skull className="w-3.5 h-3.5" /> Kill Node
            </Button>
            <Button
              onClick={() => setInteractionMode('partition')}
              variant="outline"
              size="sm"
              className={`w-full justify-start gap-2 font-mono text-xs border-border bg-surface hover:bg-warning/10 hover:text-warning ${
                interactionMode === 'partition' ? 'ring-1 ring-warning text-warning' : ''
              }`}
            >
              <Zap className="w-3.5 h-3.5" /> Inject Partition
            </Button>
            <LatencyButton />
          </div>
        </div>

        {/* Simulation */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Separator className="flex-1 bg-border" />
            <span className="text-[10px] font-mono text-muted-foreground tracking-widest">SIMULATION</span>
            <Separator className="flex-1 bg-border" />
          </div>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                onClick={toggleRunning}
                size="sm"
                className={`flex-1 gap-2 font-mono text-xs ${
                  running
                    ? 'bg-primary/20 text-primary hover:bg-primary/30'
                    : 'bg-success/20 text-success hover:bg-success/30'
                }`}
                variant="ghost"
              >
                {running ? <><Pause className="w-3.5 h-3.5" /> Pause</> : <><Play className="w-3.5 h-3.5" /> Run</>}
              </Button>
              <Button
                onClick={reset}
                size="sm"
                variant="ghost"
                className="gap-2 font-mono text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-muted-foreground">
                SPEED: {speed}x
              </label>
              <Slider
                value={[speed]}
                onValueChange={([v]) => setSpeed(v)}
                min={0.5}
                max={3}
                step={0.5}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LatencyButton() {
  const { setInteractionMode, interactionMode, links, setLinkLatency } = useSimulationStore();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          onClick={() => setInteractionMode('latency')}
          variant="outline"
          size="sm"
          className={`w-full justify-start gap-2 font-mono text-xs border-border bg-surface hover:bg-warning/10 hover:text-warning ${
            interactionMode === 'latency' ? 'ring-1 ring-warning text-warning' : ''
          }`}
        >
          <Timer className="w-3.5 h-3.5" /> Add Latency
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 bg-card border-border p-2" side="right">
        <div className="space-y-1">
          <p className="text-[10px] font-mono text-muted-foreground mb-2">Select a link, then set latency:</p>
          {[200, 2000].map(ms => (
            <Button
              key={ms}
              variant="ghost"
              size="sm"
              className="w-full justify-start font-mono text-xs"
              onClick={() => {
                const activeLinks = links.filter(l => !l.partitioned);
                if (activeLinks.length > 0) {
                  setLinkLatency(activeLinks[0].id, ms);
                }
                setOpen(false);
              }}
            >
              {ms}ms
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start font-mono text-xs text-destructive"
            onClick={() => {
              const activeLinks = links.filter(l => !l.partitioned);
              if (activeLinks.length > 0) {
                setLinkLatency(activeLinks[0].id, Infinity);
              }
              setOpen(false);
            }}
          >
            ∞ (Block)
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
