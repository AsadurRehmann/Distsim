import { create } from 'zustand';

export type Protocol = 'raft' | 'gossip' | 'consistent-hashing' | 'vector-clocks' | '2pc';
export type NodeStatus = 'healthy' | 'dead' | 'candidate' | 'leader' | 'follower' | 'waiting';
export type NodeRole = 'Leader' | 'Follower' | 'Candidate' | 'Coordinator' | 'Participant' | 'Node';
export type InteractionMode = 'none' | 'connect' | 'kill' | 'partition' | 'latency';

export interface SimNode {
  id: string;
  x: number;
  y: number;
  status: NodeStatus;
  role: NodeRole;
  vectorClock?: number[];
  gossipValue?: string | null;
}

export interface SimLink {
  id: string;
  source: string;
  target: string;
  partitioned: boolean;
  latency: number; // 0 = normal, >0 = added latency, Infinity = blocked
}

export interface MessagePacket {
  id: string;
  from: string;
  to: string;
  type: string;
  progress: number; // 0 to 1
  color: 'primary' | 'success' | 'destructive' | 'warning';
  fade?: number; // 1 = fully visible, 0 = gone (used for infinite latency fadeout)
}

export interface EventLogEntry {
  id: string;
  time: number; // ms since start
  text: string;
  type: 'info' | 'success' | 'danger' | 'warning';
}

interface SimState {
  protocol: Protocol;
  nodes: SimNode[];
  links: SimLink[];
  packets: MessagePacket[];
  events: EventLogEntry[];
  running: boolean;
  speed: number;
  interactionMode: InteractionMode;
  connectSource: string | null;
  elapsedMs: number;

  // Raft state
  term: number;
  logEntries: number;
  messagesPerSec: number;
  messageHistory: { time: number; count: number }[];

  // Gossip state
  gossipConverged: boolean;

  // Consistent Hashing state
  hashKeys: { id: string; angle: number; owner: string }[];
  nodeAngles: { id: string; angle: number }[];
  ringMode: boolean;

  // Vector Clocks state
  concurrentNodes: string[];

  // 2PC state
  tpcPhase: 'idle' | 'prepare' | 'commit' | 'abort' | 'blocked';
  tpcVotes: Record<string, 'yes' | 'no' | 'pending'>;
  beginTransaction: () => void;
  // Actions
  setProtocol: (p: Protocol) => void;
  addNode: () => void;
  removeNode: (id: string) => void;
  updateNodePosition: (id: string, x: number, y: number) => void;
  setInteractionMode: (m: InteractionMode) => void;
  handleNodeClick: (id: string) => void;
  handleLinkClick: (id: string) => void;
  toggleRunning: () => void;
  reset: () => void;
  setSpeed: (s: number) => void;
  addPacket: (p: Omit<MessagePacket, 'id' | 'progress'>) => void;
  removePacket: (id: string) => void;
  addEvent: (text: string, type: EventLogEntry['type']) => void;
  killNode: (id: string) => void;
  partitionLink: (id: string) => void;
  setLinkLatency: (id: string, latency: number) => void;
  electLeader: (id: string) => void;
  incrementTerm: () => void;
  incrementLog: () => void;
  setMessagesPerSec: (n: number) => void;
  addMessageHistory: (entry: { time: number; count: number }) => void;
  setElapsedMs: (ms: number) => void;
  setNodes: (nodes: SimNode[]) => void;
  setGossipConverged: (v: boolean) => void;
  setNodeGossipValue: (id: string, value: string) => void;
  setHashKeys: (keys: SimState['hashKeys']) => void;
  setNodeAngles: (angles: SimState['nodeAngles']) => void;
  setRingMode: (v: boolean) => void;
  setConcurrentNodes: (ids: string[]) => void;
  loadScenario: (scenario: { protocol: Protocol; nodes: SimNode[]; links: SimLink[]; term?: number; speed?: number; events?: EventLogEntry[] }) => void;
}

let nodeCounter = 0;
let packetCounter = 0;
let eventCounter = 0;

const initialNodes: SimNode[] = [
  { id: 'N1', x: 300, y: 200, status: 'leader', role: 'Leader' },
  { id: 'N2', x: 500, y: 150, status: 'follower', role: 'Follower' },
  { id: 'N3', x: 500, y: 350, status: 'follower', role: 'Follower' },
  { id: 'N4', x: 300, y: 400, status: 'follower', role: 'Follower' },
];

const initialLinks: SimLink[] = [
  { id: 'L1', source: 'N1', target: 'N2', partitioned: false, latency: 0 },
  { id: 'L2', source: 'N1', target: 'N3', partitioned: false, latency: 0 },
  { id: 'L3', source: 'N1', target: 'N4', partitioned: false, latency: 0 },
  { id: 'L4', source: 'N2', target: 'N3', partitioned: false, latency: 0 },
  { id: 'L5', source: 'N2', target: 'N4', partitioned: false, latency: 0 },
  { id: 'L6', source: 'N3', target: 'N4', partitioned: false, latency: 0 },
];

nodeCounter = 4;

export const useSimulationStore = create<SimState>((set, get) => ({
  protocol: 'raft',
  nodes: initialNodes,
  links: initialLinks,
  packets: [],
  events: [
    { id: 'e0', time: 0, text: 'System initialized with 4 nodes', type: 'info' },
    { id: 'e1', time: 100, text: 'N1 elected as Leader (Term 1)', type: 'success' },
  ],
  running: true,
  speed: 1,
  interactionMode: 'none',
  connectSource: null,
  elapsedMs: 0,
  term: 1,
  logEntries: 0,
  messagesPerSec: 0,
  messageHistory: [],
  gossipConverged: false,
  hashKeys: [],
  nodeAngles: [],
  ringMode: false,
  concurrentNodes: [],
  tpcPhase: 'idle',
  tpcVotes: {},
  beginTransaction: () => {
    // Implemented externally via runTransaction - this is a placeholder
    // The actual call happens from the sidebar via the hook
  },

  setProtocol: (p) => {
    nodeCounter = 4;
    const defaultNodes: SimNode[] = [
      { id: 'N1', x: 300, y: 200, status: 'healthy', role: 'Node' },
      { id: 'N2', x: 500, y: 150, status: 'healthy', role: 'Node' },
      { id: 'N3', x: 500, y: 350, status: 'healthy', role: 'Node' },
      { id: 'N4', x: 300, y: 400, status: 'healthy', role: 'Node' },
    ];
    const defaultLinks: SimLink[] = [
      { id: 'L1', source: 'N1', target: 'N2', partitioned: false, latency: 0 },
      { id: 'L2', source: 'N1', target: 'N3', partitioned: false, latency: 0 },
      { id: 'L3', source: 'N1', target: 'N4', partitioned: false, latency: 0 },
      { id: 'L4', source: 'N2', target: 'N3', partitioned: false, latency: 0 },
      { id: 'L5', source: 'N2', target: 'N4', partitioned: false, latency: 0 },
      { id: 'L6', source: 'N3', target: 'N4', partitioned: false, latency: 0 },
    ];
    set({
      protocol: p,
      nodes: defaultNodes,
      links: defaultLinks,
      packets: [],
      events: [{ id: `e-switch-${Date.now()}`, time: 0, text: `Switched to ${p} protocol`, type: 'info' as const }],
      running: true,
      term: 1,
      logEntries: 0,
      messagesPerSec: 0,
      messageHistory: [],
      elapsedMs: 0,
      interactionMode: 'none',
      connectSource: null,
      gossipConverged: false,
      hashKeys: [],
      nodeAngles: [],
      ringMode: false,
      concurrentNodes: [],
      tpcPhase: 'idle',
      tpcVotes: {},
    });
  },
  
  addNode: () => {
    nodeCounter++;
    const id = `N${nodeCounter}`;
    const x = 200 + Math.random() * 300;
    const y = 150 + Math.random() * 250;
    const { protocol, nodes } = get();
    const role: NodeRole = protocol === 'raft' ? 'Follower' : protocol === '2pc' ? 'Participant' : 'Node';
    const newNode: SimNode = { id, x, y, status: protocol === 'raft' ? 'follower' : 'healthy', role };
    
    // Connect to all existing alive nodes
    const newLinks: SimLink[] = nodes
      .filter(n => n.status !== 'dead')
      .map(n => ({
        id: `L${id}-${n.id}`,
        source: id,
        target: n.id,
        partitioned: false,
        latency: 0,
      }));

    // Vector Clocks: resize all clocks atomically
    if (protocol === 'vector-clocks') {
      const newLen = nodes.length + 1;
      const resizedNodes = nodes.map(n => ({
        ...n,
        vectorClock: n.vectorClock ? [...n.vectorClock, 0] : new Array(newLen).fill(0),
      }));
      newNode.vectorClock = new Array(newLen).fill(0);
      set(s => ({
        nodes: [...resizedNodes, newNode],
        links: [...s.links, ...newLinks],
      }));
    } else {
      set(s => ({
        nodes: [...s.nodes, newNode],
        links: [...s.links, ...newLinks],
      }));
    }
    get().addEvent(`${id} joined the cluster`, 'info');
  },

  removeNode: (id) => set(s => ({
    nodes: s.nodes.filter(n => n.id !== id),
    links: s.links.filter(l => l.source !== id && l.target !== id),
  })),

  updateNodePosition: (id, x, y) => set(s => ({
    nodes: s.nodes.map(n => n.id === id ? { ...n, x, y } : n),
  })),

  setInteractionMode: (m) => set(s => ({ 
    interactionMode: s.interactionMode === m ? 'none' : m, 
    connectSource: null 
  })),

  handleNodeClick: (id) => {
    const { interactionMode, connectSource } = get();
    if (interactionMode === 'kill') {
      get().killNode(id);
      set({ interactionMode: 'none' });
    } else if (interactionMode === 'connect') {
      if (!connectSource) {
        set({ connectSource: id });
      } else if (connectSource !== id) {
        const linkId = `L${connectSource}-${id}`;
        const exists = get().links.some(l => 
          (l.source === connectSource && l.target === id) || 
          (l.source === id && l.target === connectSource)
        );
        if (!exists) {
          set(s => ({
            links: [...s.links, { id: linkId, source: connectSource, target: id, partitioned: false, latency: 0 }],
          }));
          get().addEvent(`Link created: ${connectSource} ↔ ${id}`, 'info');
        }
        set({ connectSource: null, interactionMode: 'none' });
      }
    }
  },

  handleLinkClick: (id) => {
    const { interactionMode } = get();
    if (interactionMode === 'partition') {
      get().partitionLink(id);
      set({ interactionMode: 'none' });
    }
  },

  toggleRunning: () => set(s => ({ running: !s.running })),
  
  reset: () => {
    nodeCounter = 4;
    set({
      nodes: initialNodes.map(n => ({ ...n })),
      links: initialLinks.map(l => ({ ...l })),
      packets: [],
      events: [{ id: 'e-reset', time: 0, text: 'System reset', type: 'info' }],
      running: true,
      term: 1,
      logEntries: 0,
      messagesPerSec: 0,
      messageHistory: [],
      elapsedMs: 0,
      interactionMode: 'none',
      connectSource: null,
      gossipConverged: false,
    });
  },

  setSpeed: (s) => set({ speed: s }),

  addPacket: (p) => {
    packetCounter++;
    set(s => ({ packets: [...s.packets, { ...p, id: `pkt-${packetCounter}`, progress: 0 }] }));
  },

  removePacket: (id) => set(s => ({ packets: s.packets.filter(p => p.id !== id) })),

  addEvent: (text, type) => {
    eventCounter++;
    set(s => ({
      events: [...s.events.slice(-100), { id: `evt-${eventCounter}`, time: s.elapsedMs, text, type }],
    }));
  },

  killNode: (id) => {
    set(s => ({
      nodes: s.nodes.map(n => n.id === id ? { ...n, status: 'dead' as const, role: 'Follower' as const } : n),
      packets: s.packets.filter(p => p.from !== id && p.to !== id),
    }));
    get().addEvent(`${id} declared DEAD`, 'danger');
  },

  partitionLink: (id) => {
    const link = get().links.find(l => l.id === id);
    if (link) {
      set(s => ({
        links: s.links.map(l => l.id === id ? { ...l, partitioned: !l.partitioned } : l),
      }));
      get().addEvent(`Partition ${link.partitioned ? 'healed' : 'injected'}: ${link.source} ↔ ${link.target}`, link.partitioned ? 'success' : 'warning');
    }
  },

  setLinkLatency: (id, latency) => {
    const link = get().links.find(l => l.id === id);
    if (link) {
      set(s => ({
        links: s.links.map(l => l.id === id ? { ...l, latency } : l),
      }));
      get().addEvent(`Latency set to ${latency === Infinity ? '∞' : latency + 'ms'} on ${link.source} ↔ ${link.target}`, 'warning');
    }
  },

  electLeader: (id) => {
    set(s => ({
      nodes: s.nodes.map(n => {
        if (n.status === 'dead') return n;
        if (n.id === id) return { ...n, status: 'leader' as const, role: 'Leader' as const };
        return { ...n, status: 'follower' as const, role: 'Follower' as const };
      }),
    }));
  },

  incrementTerm: () => set(s => ({ term: s.term + 1 })),
  incrementLog: () => set(s => ({ logEntries: s.logEntries + 1 })),
  setMessagesPerSec: (n) => set({ messagesPerSec: n }),
  addMessageHistory: (entry) => set(s => ({
    messageHistory: [...s.messageHistory.slice(-30), entry],
  })),
  setElapsedMs: (ms) => set({ elapsedMs: ms }),
  setNodes: (nodes) => set({ nodes }),
  setGossipConverged: (v) => set({ gossipConverged: v }),
  setNodeGossipValue: (id, value) => set(s => ({
    nodes: s.nodes.map(n => n.id === id ? { ...n, gossipValue: value } : n),
  })),
  setHashKeys: (keys) => set({ hashKeys: keys }),
  setNodeAngles: (angles) => set({ nodeAngles: angles }),
  setRingMode: (v) => set({ ringMode: v }),
  setConcurrentNodes: (ids) => set({ concurrentNodes: ids }),
  loadScenario: (scenario) => {
    nodeCounter = scenario.nodes.length;
    set({
      protocol: scenario.protocol,
      nodes: scenario.nodes,
      links: scenario.links,
      packets: [],
      events: scenario.events ?? [{ id: 'e-scenario', time: 0, text: `Scenario loaded: ${scenario.protocol}`, type: 'info' as const }],
      running: true,
      speed: scenario.speed ?? 1,
      term: scenario.term ?? 1,
      logEntries: 0,
      messagesPerSec: 0,
      messageHistory: [],
      elapsedMs: 0,
      interactionMode: 'none',
      connectSource: null,
    });
  },
}));
