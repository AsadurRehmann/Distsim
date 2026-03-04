import { Protocol } from '@/store/simulationStore';

interface ProtocolGuide {
  title: string;
  overview: string;
  animations: { term: string; description: string }[];
  tryBreaking: string[];
}

const guides: Record<Protocol, ProtocolGuide> = {
  raft: {
    title: 'Raft Consensus',
    overview:
      'Raft is a consensus algorithm that ensures a cluster of nodes agrees on a single sequence of commands, even when some nodes fail. One node is elected Leader and is responsible for replicating log entries to all Followers. If the Leader goes down, the remaining nodes hold an election to pick a new one.',
    animations: [
      { term: 'Cyan packets', description: 'AppendEntries heartbeats sent from the Leader to every Follower, keeping them in sync and proving the Leader is alive.' },
      { term: 'Amber packets', description: 'RequestVote messages sent by a Candidate during an election, asking peers for their vote.' },
      { term: 'Green ring', description: 'The node currently serving as Leader — the single source of truth for the cluster.' },
      { term: 'Term number', description: 'A monotonically increasing counter that increments with every election. It acts as a logical clock for leadership.' },
      { term: 'Log entries', description: 'The count of successfully replicated commands. Each heartbeat round appends a new entry.' },
    ],
    tryBreaking: [
      'Kill the Leader and watch the election timeout trigger a new vote.',
      'Partition the Leader from a majority of nodes — it will keep sending heartbeats into the void while a new Leader is elected.',
      'Add high latency to a single link and observe how that Follower falls behind on log replication.',
      'Kill enough nodes to destroy quorum (more than half) — no new Leader can be elected.',
    ],
  },
  gossip: {
    title: 'Gossip Protocol',
    overview:
      'Gossip (or epidemic) protocols spread information through a cluster the way rumors spread in a crowd. Each node periodically picks a few random neighbors and shares its state. Over time, every node converges to the same value — even without a central coordinator.',
    animations: [
      { term: 'Amber packets', description: 'Gossip messages fanning out from a node to two randomly chosen neighbors.' },
      { term: 'Converged badge', description: 'Appears in green when every alive node holds the same state value.' },
      { term: 'Fan-out pattern', description: 'Each round, a node picks 2 random peers — this randomness is what makes gossip robust to failures.' },
    ],
    tryBreaking: [
      'Kill a node and see that gossip still converges among the remaining nodes.',
      'Partition the cluster in half and watch each partition converge independently.',
      'Add latency to links and observe how convergence slows down.',
    ],
  },
  'consistent-hashing': {
    title: 'Consistent Hashing',
    overview:
      'Consistent Hashing distributes data across nodes arranged on a virtual ring. Each key is assigned to the first node encountered clockwise on the ring. Adding or removing a node only affects a small fraction of keys, unlike traditional hashing.',
    animations: [
      { term: 'Ring layout', description: 'Nodes sit at positions determined by hashing their ID. The ring represents the full hash space (0–360°).' },
      { term: 'Colored key dots', description: 'Each dot is a key hashed onto the ring, assigned to the nearest clockwise node.' },
      { term: 'Key redistribution', description: 'When a node joins or leaves, only the keys between it and its predecessor move.' },
    ],
    tryBreaking: [
      'Remove a node and watch its keys flow to the next node clockwise.',
      'Add a node and see it absorb keys from its successor.',
      'Remove multiple nodes and observe hot-spotting on the remaining ones.',
    ],
  },
  'vector-clocks': {
    title: 'Vector Clocks',
    overview:
      'Vector Clocks track causal ordering of events across distributed nodes. Each node maintains a vector of counters (one per node). When a message is sent, the sender increments its own counter and attaches the full vector. The receiver merges by taking the element-wise maximum.',
    animations: [
      { term: 'Clock badge', description: 'The [0,0,0,0] array displayed on each node, showing its view of the global event history.' },
      { term: 'Cyan packets', description: 'Messages carrying vector clock payloads between nodes.' },
      { term: 'Amber highlight', description: 'Indicates a conflict — two events are concurrent (neither vector dominates the other).' },
    ],
    tryBreaking: [
      'Partition two nodes and have both send messages independently — their clocks will diverge, creating a conflict.',
      'Kill the node with the highest clock values and see how the remaining nodes\' vectors reflect the gap.',
      'Add latency to observe messages arriving out of order.',
    ],
  },
  '2pc': {
    title: 'Two-Phase Commit',
    overview:
      'Two-Phase Commit (2PC) is a protocol for distributed transactions. A Coordinator asks all Participants to prepare, then either commits or aborts based on unanimous agreement. Its biggest weakness: if the Coordinator crashes mid-commit, participants are left stuck in a blocking WAITING state.',
    animations: [
      { term: 'Cyan packets (Phase 1)', description: 'PREPARE messages sent from the Coordinator to all Participants.' },
      { term: 'Green packets (Phase 2)', description: 'COMMIT messages sent after all Participants vote YES.' },
      { term: 'Red packets', description: 'ABORT messages sent if any Participant votes NO.' },
      { term: 'Amber spinning indicator', description: 'A Participant stuck in WAITING state — it has voted YES but hasn\'t received the final COMMIT/ABORT.' },
    ],
    tryBreaking: [
      'Kill the Coordinator after Phase 1 (PREPARE) — watch Participants get stuck in WAITING.',
      'Kill a Participant before it can vote — the Coordinator will time out and abort.',
      'Partition the Coordinator from one Participant during Phase 2 — that node never gets the COMMIT.',
    ],
  },
};

export function getProtocolGuide(protocol: Protocol): ProtocolGuide {
  return guides[protocol];
}
