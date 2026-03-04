import { useEffect, useRef, useCallback } from 'react';
import { useSimulationStore } from '@/store/simulationStore';

export function useGossipSimulation() {
  const getStore = useCallback(() => useSimulationStore.getState(), []);
  const gossipRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasLoggedConvergence = useRef(false);

  const { running, protocol, speed } = useSimulationStore();

  // Initialize gossip values when switching to gossip protocol
  useEffect(() => {
    if (protocol !== 'gossip') {
      hasLoggedConvergence.current = false;
      return;
    }
    const s = getStore();
    // Set N1 (or first node) with value "X", others null
    const updated = s.nodes.map((n, i) => ({
      ...n,
      gossipValue: i === 0 ? 'X' : (n.gossipValue ?? null),
      status: n.status === 'dead' ? n.status : 'healthy' as const,
      role: 'Node' as const,
    }));
    useSimulationStore.setState({ nodes: updated, gossipConverged: false });
    hasLoggedConvergence.current = false;
    s.addEvent('Gossip protocol active — N1 has value "X"', 'info');
  }, [protocol, getStore]);

  // Gossip tick: each alive node fans out to 2 random alive neighbors
  useEffect(() => {
    if (!running || protocol !== 'gossip') {
      if (gossipRef.current) clearInterval(gossipRef.current);
      return;
    }

    gossipRef.current = setInterval(() => {
      const s = getStore();
      if (s.protocol !== 'gossip') return;
      console.log('[DistSim] Gossip tick');

      const aliveNodes = s.nodes.filter(n => n.status !== 'dead');

      aliveNodes.forEach(node => {
        if (!node.gossipValue) return; // nothing to share

        // Find alive neighbors connected via non-partitioned links
        const neighbors = aliveNodes.filter(n => {
          if (n.id === node.id) return false;
          return s.links.some(l =>
            ((l.source === node.id && l.target === n.id) || (l.source === n.id && l.target === node.id))
            && !l.partitioned
          );
        });

        if (neighbors.length === 0) return;

        // Pick up to 2 random neighbors
        const shuffled = [...neighbors].sort(() => Math.random() - 0.5);
        const targets = shuffled.slice(0, 2);

        targets.forEach(target => {
          s.addPacket({
            from: node.id,
            to: target.id,
            type: 'Gossip',
            color: 'warning',
          });
        });
      });
    }, 1000 / speed);

    return () => { if (gossipRef.current) clearInterval(gossipRef.current); };
  }, [running, protocol, speed, getStore]);

  // Handle packet arrival: when a gossip packet completes, adopt value
  // We piggyback on the packet animation loop — check for completed gossip packets
  useEffect(() => {
    if (!running || protocol !== 'gossip') return;

    const interval = setInterval(() => {
      const s = getStore();
      if (s.protocol !== 'gossip') return;

      // Check completed packets (progress >= 1 are removed by main loop, 
      // so we check packets near completion and pre-apply value)
      s.packets.forEach(pkt => {
        if (pkt.type !== 'Gossip') return;
        if (pkt.progress >= 0.95) {
          const fromNode = s.nodes.find(n => n.id === pkt.from);
          const toNode = s.nodes.find(n => n.id === pkt.to);
          if (fromNode?.gossipValue && toNode && !toNode.gossipValue) {
            s.setNodeGossipValue(toNode.id, fromNode.gossipValue);
            s.addEvent(`${toNode.id} received value "${fromNode.gossipValue}" from ${fromNode.id}`, 'info');
          }
        }
      });

      // Check convergence
      const currentNodes = getStore().nodes;
      const alive = currentNodes.filter(n => n.status !== 'dead');
      if (alive.length > 0) {
        const allHaveValue = alive.every(n => n.gossipValue != null);
        const allSame = allHaveValue && alive.every(n => n.gossipValue === alive[0].gossipValue);
        
        if (allSame && !hasLoggedConvergence.current) {
          hasLoggedConvergence.current = true;
          const store = getStore();
          store.setGossipConverged(true);
          store.addEvent(`🎉 CONVERGED — all ${alive.length} nodes hold value "${alive[0].gossipValue}"`, 'success');
        } else if (!allSame && hasLoggedConvergence.current) {
          hasLoggedConvergence.current = false;
          getStore().setGossipConverged(false);
        }
      }
    }, 50);

    return () => clearInterval(interval);
  }, [running, protocol, getStore]);
}
