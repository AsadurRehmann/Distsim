import { useEffect, useRef, useCallback } from 'react';
import { useSimulationStore } from '@/store/simulationStore';

export function useVectorClocksSimulation() {
  const getStore = useCallback(() => useSimulationStore.getState(), []);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const receiveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { running, protocol, speed } = useSimulationStore();

  // Initialize vector clocks when switching to vector-clocks protocol
  useEffect(() => {
    if (protocol !== 'vector-clocks') return;
    const s = getStore();
    const n = s.nodes.length;
    const updated = s.nodes.map((node, i) => ({
      ...node,
      vectorClock: new Array(n).fill(0),
      status: node.status === 'dead' ? node.status : 'healthy' as const,
      role: 'Node' as const,
    }));
    useSimulationStore.setState({ nodes: updated, concurrentNodes: [] });
    s.addEvent('Vector Clocks protocol active — all clocks initialized to zero', 'info');
  }, [protocol, getStore]);

  // Main tick: every 1200ms/speed, a random alive node sends to a random alive neighbor
  useEffect(() => {
    if (!running || protocol !== 'vector-clocks') {
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }

    tickRef.current = setInterval(() => {
      const s = getStore();
      if (s.protocol !== 'vector-clocks') return;
      console.log('[DistSim] Vector Clocks tick');

      const aliveNodes = s.nodes.filter(n => n.status !== 'dead');
      if (aliveNodes.length < 2) return;

      // Pick random sender
      const sender = aliveNodes[Math.floor(Math.random() * aliveNodes.length)];

      // Find alive neighbors connected via non-partitioned links
      const neighbors = aliveNodes.filter(n => {
        if (n.id === sender.id) return false;
        return s.links.some(l =>
          ((l.source === sender.id && l.target === n.id) || (l.source === n.id && l.target === sender.id))
          && !l.partitioned
        );
      });

      if (neighbors.length === 0) return;

      const receiver = neighbors[Math.floor(Math.random() * neighbors.length)];

      // Sender increments its own index
      const senderIdx = s.nodes.findIndex(n => n.id === sender.id);
      if (senderIdx === -1 || !sender.vectorClock) return;

      const newSenderClock = [...sender.vectorClock];
      newSenderClock[senderIdx] = (newSenderClock[senderIdx] || 0) + 1;

      // Update sender's clock in store
      const updatedNodes = s.nodes.map((n, i) =>
        i === senderIdx ? { ...n, vectorClock: newSenderClock } : n
      );
      useSimulationStore.setState({ nodes: updatedNodes });

      // Send packet with clock data attached (we store the sent clock in the packet type)
      s.addPacket({
        from: sender.id,
        to: receiver.id,
        type: `VClock:${JSON.stringify(newSenderClock)}`,
        color: 'primary',
      });

      const clockStr = `[${newSenderClock.join(',')}]`;
      s.addEvent(`${sender.id} → ${receiver.id}: send ${clockStr}`, 'info');
    }, 1200 / speed);

    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [running, protocol, speed, getStore]);

  // Receive handler: check packets near completion
  useEffect(() => {
    if (!running || protocol !== 'vector-clocks') {
      if (receiveRef.current) clearInterval(receiveRef.current);
      return;
    }

    const processedPackets = new Set<string>();

    receiveRef.current = setInterval(() => {
      const s = getStore();
      if (s.protocol !== 'vector-clocks') return;

      s.packets.forEach(pkt => {
        if (!pkt.type.startsWith('VClock:')) return;
        if (pkt.progress < 0.95) return;
        if (processedPackets.has(pkt.id)) return;
        processedPackets.add(pkt.id);

        const sentClock: number[] = JSON.parse(pkt.type.replace('VClock:', ''));
        const receiverIdx = s.nodes.findIndex(n => n.id === pkt.to);
        const receiver = s.nodes[receiverIdx];
        if (!receiver || receiver.status === 'dead' || !receiver.vectorClock) return;

        // Element-wise max, then increment own index
        const newClock = receiver.vectorClock.map((v, i) => Math.max(v, sentClock[i] || 0));
        newClock[receiverIdx] = (newClock[receiverIdx] || 0) + 1;

        // Check for concurrency between sender and receiver BEFORE merging
        const senderIdx = s.nodes.findIndex(n => n.id === pkt.from);
        const senderNode = s.nodes[senderIdx];
        if (senderNode?.vectorClock) {
          const concurrent = detectConcurrency(receiver.vectorClock, sentClock);
          if (concurrent) {
            // Flash amber on both nodes
            useSimulationStore.setState({ concurrentNodes: [pkt.from, pkt.to] });
            s.addEvent(`⚠ Concurrent events detected: ${pkt.from} ↔ ${pkt.to}`, 'warning');
            setTimeout(() => {
              useSimulationStore.setState({ concurrentNodes: [] });
            }, 1500);
          }
        }

        const updatedNodes = s.nodes.map((n, i) =>
          i === receiverIdx ? { ...n, vectorClock: newClock } : n
        );
        useSimulationStore.setState({ nodes: updatedNodes });

        const clockStr = `[${newClock.join(',')}]`;
        s.addEvent(`${pkt.to} received from ${pkt.from}: clock → ${clockStr}`, 'success');
      });
    }, 50);

    return () => { if (receiveRef.current) clearInterval(receiveRef.current); };
  }, [running, protocol, getStore]);
}

// Two clocks are concurrent if neither dominates the other
function detectConcurrency(a: number[], b: number[]): boolean {
  const len = Math.max(a.length, b.length);
  let aGreater = false;
  let bGreater = false;
  for (let i = 0; i < len; i++) {
    const va = a[i] || 0;
    const vb = b[i] || 0;
    if (va > vb) aGreater = true;
    if (vb > va) bGreater = true;
    if (aGreater && bGreater) return true;
  }
  return aGreater && bGreater;
}
