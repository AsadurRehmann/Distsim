import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FlaskConical } from 'lucide-react';
import { useSimulationStore, Protocol, SimNode, SimLink, EventLogEntry } from '@/store/simulationStore';

interface Scenario {
  id: string;
  title: string;
  protocol: Protocol;
  description: string;
  observe: string;
  nodes: SimNode[];
  links: SimLink[];
  term?: number;
  speed?: number;
  events?: EventLogEntry[];
}

const scenarios: Scenario[] = [
  {
    id: 'split-brain',
    title: 'Split Brain',
    protocol: 'raft',
    description: 'A 6-node Raft cluster gets partitioned into two halves. Each half tries to elect its own Leader, but only the majority partition succeeds.',
    observe: 'Watch the minority partition fail to elect a Leader (no quorum). The majority side elects normally. Heal the partition to see the cluster reunify under one Leader.',
    term: 1,
    speed: 1,
    nodes: [
      { id: 'N1', x: 180, y: 180, status: 'leader', role: 'Leader' },
      { id: 'N2', x: 180, y: 300, status: 'follower', role: 'Follower' },
      { id: 'N3', x: 180, y: 420, status: 'follower', role: 'Follower' },
      { id: 'N4', x: 520, y: 180, status: 'follower', role: 'Follower' },
      { id: 'N5', x: 520, y: 300, status: 'follower', role: 'Follower' },
      { id: 'N6', x: 520, y: 420, status: 'follower', role: 'Follower' },
    ],
    links: [
      { id: 'L1', source: 'N1', target: 'N2', partitioned: false, latency: 0 },
      { id: 'L2', source: 'N1', target: 'N3', partitioned: false, latency: 0 },
      { id: 'L3', source: 'N2', target: 'N3', partitioned: false, latency: 0 },
      { id: 'L4', source: 'N4', target: 'N5', partitioned: false, latency: 0 },
      { id: 'L5', source: 'N4', target: 'N6', partitioned: false, latency: 0 },
      { id: 'L6', source: 'N5', target: 'N6', partitioned: false, latency: 0 },
      { id: 'L7', source: 'N1', target: 'N4', partitioned: true, latency: 0 },
      { id: 'L8', source: 'N2', target: 'N5', partitioned: true, latency: 0 },
      { id: 'L9', source: 'N3', target: 'N6', partitioned: true, latency: 0 },
    ],
    events: [
      { id: 'e0', time: 0, text: 'Scenario: Split Brain loaded', type: 'warning' },
      { id: 'e1', time: 0, text: 'Network partitioned into [N1,N2,N3] and [N4,N5,N6]', type: 'danger' },
    ],
  },
  {
    id: 'leader-election',
    title: 'Leader Election',
    protocol: 'raft',
    description: 'A healthy 5-node Raft cluster where the Leader has just died. Watch the election unfold in real time — candidates request votes, a majority decides the new Leader.',
    observe: 'The dead Leader (N1) turns grey with a skull. After 2s, surviving nodes enter Candidate state and exchange RequestVote packets. The first to get 3 votes wins.',
    term: 3,
    speed: 1,
    nodes: [
      { id: 'N1', x: 350, y: 150, status: 'dead', role: 'Follower' },
      { id: 'N2', x: 200, y: 280, status: 'follower', role: 'Follower' },
      { id: 'N3', x: 500, y: 280, status: 'follower', role: 'Follower' },
      { id: 'N4', x: 250, y: 430, status: 'follower', role: 'Follower' },
      { id: 'N5', x: 450, y: 430, status: 'follower', role: 'Follower' },
    ],
    links: [
      { id: 'L1', source: 'N2', target: 'N3', partitioned: false, latency: 0 },
      { id: 'L2', source: 'N2', target: 'N4', partitioned: false, latency: 0 },
      { id: 'L3', source: 'N2', target: 'N5', partitioned: false, latency: 0 },
      { id: 'L4', source: 'N3', target: 'N4', partitioned: false, latency: 0 },
      { id: 'L5', source: 'N3', target: 'N5', partitioned: false, latency: 0 },
      { id: 'L6', source: 'N4', target: 'N5', partitioned: false, latency: 0 },
    ],
    events: [
      { id: 'e0', time: 0, text: 'Scenario: Leader Election loaded', type: 'warning' },
      { id: 'e1', time: 0, text: 'N1 (former Leader, Term 3) has crashed', type: 'danger' },
      { id: 'e2', time: 0, text: 'Election timeout will trigger shortly...', type: 'info' },
    ],
  },
  {
    id: 'gossip-convergence',
    title: 'Gossip Convergence',
    protocol: 'gossip',
    description: 'A 6-node gossip cluster where only N1 starts with an updated value. Watch the value spread through random peer-to-peer exchanges until all nodes converge.',
    observe: 'Amber gossip packets fan out from informed nodes to random neighbors. Track how many rounds it takes for all 6 nodes to hold the same value. Adding latency slows convergence.',
    nodes: [
      { id: 'N1', x: 350, y: 130, status: 'healthy', role: 'Node' },
      { id: 'N2', x: 200, y: 250, status: 'healthy', role: 'Node' },
      { id: 'N3', x: 500, y: 250, status: 'healthy', role: 'Node' },
      { id: 'N4', x: 150, y: 400, status: 'healthy', role: 'Node' },
      { id: 'N5', x: 350, y: 430, status: 'healthy', role: 'Node' },
      { id: 'N6', x: 550, y: 400, status: 'healthy', role: 'Node' },
    ],
    links: [
      { id: 'L1', source: 'N1', target: 'N2', partitioned: false, latency: 0 },
      { id: 'L2', source: 'N1', target: 'N3', partitioned: false, latency: 0 },
      { id: 'L3', source: 'N2', target: 'N3', partitioned: false, latency: 0 },
      { id: 'L4', source: 'N2', target: 'N4', partitioned: false, latency: 0 },
      { id: 'L5', source: 'N3', target: 'N6', partitioned: false, latency: 0 },
      { id: 'L6', source: 'N4', target: 'N5', partitioned: false, latency: 0 },
      { id: 'L7', source: 'N5', target: 'N6', partitioned: false, latency: 0 },
      { id: 'L8', source: 'N1', target: 'N5', partitioned: false, latency: 0 },
    ],
    events: [
      { id: 'e0', time: 0, text: 'Scenario: Gossip Convergence loaded', type: 'warning' },
      { id: 'e1', time: 0, text: 'N1 has a new value — watching it spread via gossip', type: 'info' },
    ],
  },
  {
    id: 'hash-ring-rebalance',
    title: 'Hash Ring Rebalance',
    protocol: 'consistent-hashing',
    description: 'A consistent hash ring with 4 nodes and 10 keys. A 5th node is about to join, triggering key redistribution. Only keys between the new node and its predecessor need to move.',
    observe: 'When the new node joins the ring, watch keys animate from the old owner to the new one. Notice how most keys stay put — only a fraction are redistributed.',
    nodes: [
      { id: 'N1', x: 350, y: 100, status: 'healthy', role: 'Node' },
      { id: 'N2', x: 550, y: 300, status: 'healthy', role: 'Node' },
      { id: 'N3', x: 350, y: 500, status: 'healthy', role: 'Node' },
      { id: 'N4', x: 150, y: 300, status: 'healthy', role: 'Node' },
    ],
    links: [
      { id: 'L1', source: 'N1', target: 'N2', partitioned: false, latency: 0 },
      { id: 'L2', source: 'N2', target: 'N3', partitioned: false, latency: 0 },
      { id: 'L3', source: 'N3', target: 'N4', partitioned: false, latency: 0 },
      { id: 'L4', source: 'N4', target: 'N1', partitioned: false, latency: 0 },
    ],
    events: [
      { id: 'e0', time: 0, text: 'Scenario: Hash Ring Rebalance loaded', type: 'warning' },
      { id: 'e1', time: 0, text: '4 nodes on ring with 10 keys — try adding a 5th node', type: 'info' },
    ],
  },
  {
    id: '2pc-coordinator-crash',
    title: '2PC Coordinator Crash',
    protocol: '2pc',
    description: 'A Two-Phase Commit transaction is in progress. The Coordinator (N1) has sent PREPARE to all Participants, received YES votes, but crashes before sending COMMIT. Participants are stuck.',
    observe: 'N1 is dead. N2–N4 are stuck in WAITING state (amber spinning). They voted YES but never got the final decision. This demonstrates the fundamental blocking problem of 2PC.',
    term: 1,
    nodes: [
      { id: 'N1', x: 350, y: 150, status: 'dead', role: 'Coordinator' },
      { id: 'N2', x: 200, y: 350, status: 'waiting', role: 'Participant' },
      { id: 'N3', x: 350, y: 430, status: 'waiting', role: 'Participant' },
      { id: 'N4', x: 500, y: 350, status: 'waiting', role: 'Participant' },
    ],
    links: [
      { id: 'L1', source: 'N1', target: 'N2', partitioned: false, latency: 0 },
      { id: 'L2', source: 'N1', target: 'N3', partitioned: false, latency: 0 },
      { id: 'L3', source: 'N1', target: 'N4', partitioned: false, latency: 0 },
      { id: 'L4', source: 'N2', target: 'N3', partitioned: false, latency: 0 },
      { id: 'L5', source: 'N2', target: 'N4', partitioned: false, latency: 0 },
      { id: 'L6', source: 'N3', target: 'N4', partitioned: false, latency: 0 },
    ],
    events: [
      { id: 'e0', time: 0, text: 'Scenario: 2PC Coordinator Crash loaded', type: 'warning' },
      { id: 'e1', time: 0, text: 'Coordinator N1 crashed after PREPARE phase', type: 'danger' },
      { id: 'e2', time: 0, text: 'N2, N3, N4 voted YES — now stuck in WAITING', type: 'warning' },
    ],
  },
];

export function ScenariosModal() {
  const [open, setOpen] = useState(false);
  const loadScenario = useSimulationStore(s => s.loadScenario);
  const addEvent = useSimulationStore(s => s.addEvent);

  const handleLoad = (scenario: Scenario) => {
    loadScenario({
      protocol: scenario.protocol,
      nodes: scenario.nodes.map(n => ({ ...n })),
      links: scenario.links.map(l => ({ ...l })),
      term: scenario.term,
      speed: scenario.speed,
      events: scenario.events?.map(e => ({ ...e })),
    });
    addEvent(`▸ Observe: ${scenario.observe}`, 'info');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 font-mono text-xs border-border bg-surface hover:bg-accent"
        >
          <FlaskConical className="w-3.5 h-3.5" /> Scenarios
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-lg max-h-[80vh] overflow-y-auto scrollbar-thin p-0">
        <DialogHeader className="p-5 pb-0">
          <DialogTitle className="font-mono text-primary text-base tracking-wide">
            Pre-built Scenarios
          </DialogTitle>
          <p className="text-xs text-muted-foreground font-outfit mt-1">
            Load a scenario to see a specific distributed systems concept in action.
          </p>
        </DialogHeader>

        <div className="p-5 pt-4 space-y-2">
          {scenarios.map(scenario => (
            <button
              key={scenario.id}
              onClick={() => handleLoad(scenario)}
              className="w-full text-left p-3 rounded-md border border-border bg-surface hover:border-primary/50 hover:bg-primary/5 transition-colors group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  {scenario.title}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider bg-background px-1.5 py-0.5 rounded">
                  {scenario.protocol}
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-outfit leading-relaxed">
                {scenario.description}
              </p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
