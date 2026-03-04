# DistSim

live link: https://distsim.vercel.app/

**Interactive Distributed Systems Laboratory**

DistSim is a browser-based visual simulator for designing, running, and stress-testing distributed systems in real time. It allows engineers, students, and researchers to observe how distributed protocols behave under normal operation and under fault conditions — without writing a single line of infrastructure code.

---

## Overview

Distributed systems are notoriously difficult to reason about. Race conditions, network partitions, split-brain scenarios, and consensus failures are hard to visualize from textbooks alone. DistSim makes these concepts tangible by letting you drag nodes onto a canvas, connect them into a topology, inject faults, and watch the system respond in real time.

The simulator currently supports five core protocols:

- **Raft Consensus** — Leader election, log replication, and term management across a cluster of nodes
- **Gossip Protocol** — Epidemic information propagation and convergence detection
- **Consistent Hashing** — Key distribution across a node ring, with live rebalancing on node addition and removal
- **Vector Clocks** — Causal message ordering and concurrent event detection across nodes
- **Two-Phase Commit** — Coordinator-driven atomic commit with failure and rollback simulation

---

## Features

### Canvas and Topology
- Drag and drop nodes onto a free-form canvas
- Draw connections between any two nodes to establish network links
- Add up to 8 nodes per simulation
- Pre-loaded with a 4-node mesh topology on launch

### Fault Injection
- **Kill Node** — Terminate any node mid-operation and observe how the protocol recovers
- **Inject Partition** — Sever a specific link between two nodes to simulate a network partition
- **Add Latency** — Apply 200ms, 2000ms, or infinite delay to any individual link

### Protocol Visualization
- Animated message packets travel along links in real time
- Node status rings reflect live state: healthy, dead, partitioned, or waiting
- Role badges update dynamically (Leader, Follower, Candidate, Coordinator, Participant)
- Vector clock arrays displayed per node and updated on every send and receive event

### Metrics and Observability
- Live metrics panel showing protocol-specific data (leader identity, term number, log index, messages per second)
- Real-time throughput chart over a 30-second rolling window
- Timestamped event log showing every protocol action, election, fault, and recovery event

### Simulation Controls
- Run and pause the simulation at any point
- Adjustable speed from 0.5x to 3x
- Full reset to restore the default topology and clear all state
- Pre-built scenario loader with curated fault scenarios

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite |
| State Management | Zustand |
| Animations | Framer Motion |
| UI Components | shadcn/ui |
| Charts | Recharts |
| Rendering | SVG (canvas graph) |
| Deployment | Vercel via GitHub |

---

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher

### Installation

```bash
git clone https://github.com/your-username/distsim.git
cd distsim
npm install
npm run dev
```

The application will be available at `http://localhost:5173`.

### Production Build

```bash
npm run build
```

Output is written to the `dist` directory.

---

## Deployment

DistSim is configured for zero-configuration deployment on Vercel.

```
Build Command:   npm run build
Output Directory: dist
Framework Preset: Vite
```

Every push to the `main` branch triggers an automatic redeploy. No environment variables are required.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com)

---

## Project Structure

```
distsim/
  src/
    components/
      Canvas.jsx          # SVG canvas, node rendering, drag logic
      Node.jsx            # Individual node circle and badges
      Link.jsx            # SVG links and packet animations
      LeftSidebar.jsx     # Protocol selector and simulation controls
      RightSidebar.jsx    # Metrics panel and event log
      MetricsChart.jsx    # Recharts rolling throughput chart
      EventLog.jsx        # Scrollable timestamped event log
    simulation/
      raft.js             # Raft consensus tick logic
      gossip.js           # Gossip propagation tick logic
      consistentHashing.js # Ring management and key redistribution
      vectorClocks.js     # Clock update and conflict detection
      twoPhaseCommit.js   # 2PC coordinator and participant logic
    store/
      simStore.js         # Zustand global simulation store
    hooks/
      useSimulationTick.js # requestAnimationFrame simulation loop
    App.jsx
  public/
  index.html
```

---

## Protocol Details

### Raft Consensus
The leader sends periodic heartbeats to all followers. If a follower does not receive a heartbeat within the election timeout window, it transitions to a candidate and solicits votes. The first candidate to receive a majority of votes becomes the new leader and increments the term number. Kill the leader to trigger a live election.

### Gossip Protocol
Each node periodically selects two random neighbors and shares its current value. Nodes that receive a new value adopt it and continue propagating. The simulator detects convergence when all alive nodes hold the same value and flashes a confirmation badge.

### Consistent Hashing
Nodes are positioned on a logical ring based on their identifier hash. Keys are assigned to the nearest clockwise node. Adding a node causes a subset of keys from its successor to redistribute. Removing a node causes all of its keys to migrate to the next alive node on the ring.

### Vector Clocks
Each node maintains a vector of integer counters, one per node in the cluster. On every send event, the sender increments its own index and attaches the full vector to the message. On receive, the recipient takes the elementwise maximum of both vectors and increments its own index. Concurrent events — where neither vector dominates the other — are highlighted in amber.

### Two-Phase Commit
Node N1 acts as the coordinator. Triggering a transaction sends PREPARE messages to all participants. Each participant votes YES or NO. If all votes are YES, the coordinator broadcasts COMMIT. If any participant votes NO or fails to respond, the coordinator broadcasts ABORT. Killing the coordinator during Phase 1 leaves responding participants blocked in a WAITING state, demonstrating the fundamental blocking problem of 2PC.

---

## Scenarios

DistSim includes five pre-built scenarios accessible from the left sidebar:

| Scenario | Protocol | What to Observe |
|---|---|---|
| Split Brain | Raft | Partition the cluster mid-election and watch two leaders emerge |
| Leader Election | Raft | Kill the current leader and observe candidate promotion |
| Gossip Convergence | Gossip | Watch a single value propagate to all nodes over time |
| Hash Ring Rebalance | Consistent Hashing | Add and remove nodes and watch keys redistribute |
| 2PC Coordinator Crash | Two-Phase Commit | Kill the coordinator mid-commit and observe participant blocking |

---

## License

MIT
