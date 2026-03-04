import { useEffect, useRef, useCallback } from 'react';
import { useSimulationStore } from '@/store/simulationStore';

export function useRaftSimulation() {
  const {
    running, speed, nodes, links, packets, protocol,
    addPacket, removePacket, addEvent, electLeader,
    incrementTerm, incrementLog, setMessagesPerSec,
    addMessageHistory, elapsedMs, setElapsedMs,
  } = useSimulationStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const packetAnimRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const electionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageCountRef = useRef(0);
  const lastSecRef = useRef(0);

  const getStore = useCallback(() => useSimulationStore.getState(), []);

  // Main clock
  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      const s = getStore();
      s.setElapsedMs(s.elapsedMs + 100 * s.speed);
    }, 100);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, getStore]);

  // Packet animation
  useEffect(() => {
    if (!running) {
      if (packetAnimRef.current) clearInterval(packetAnimRef.current);
      return;
    }
    packetAnimRef.current = setInterval(() => {
      const s = getStore();
      const toRemove: string[] = [];
      const updatedPackets = s.packets.map(p => {
        const link = s.links.find(l =>
          (l.source === p.from && l.target === p.to) ||
          (l.source === p.to && l.target === p.from)
        );
        if (link?.partitioned) return { ...p, progress: p.progress }; // stuck

        // Infinite latency: travel to 0.5 then fade
        if (link?.latency === Infinity) {
          if (p.progress >= 0.5) {
            const newFade = (p.fade ?? 1) - 0.05;
            if (newFade <= 0) {
              toRemove.push(p.id);
              return p;
            }
            return { ...p, fade: newFade };
          }
          return { ...p, progress: Math.min(0.5, p.progress + 0.02 * s.speed) };
        }

        // Proportional slowdown: base speed / (1 + latency/500)
        const latencyDivisor = link?.latency ? 1 + link.latency / 500 : 1;
        const step = (0.04 * s.speed) / latencyDivisor;
        return { ...p, progress: Math.min(1, p.progress + step) };
      });

      const done = updatedPackets.filter(p => p.progress >= 1);
      const remaining = updatedPackets.filter(p => p.progress < 1 && !toRemove.includes(p.id));

      useSimulationStore.setState({ packets: remaining });

      done.forEach(() => {
        messageCountRef.current++;
      });
    }, 50);
    return () => { if (packetAnimRef.current) clearInterval(packetAnimRef.current); };
  }, [running, getStore]);

  // Heartbeat (Raft leader sends AppendEntries)
  useEffect(() => {
    if (!running || protocol !== 'raft') {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      return;
    }

    heartbeatRef.current = setInterval(() => {
      const s = getStore();
      if (s.protocol !== 'raft') return;
      console.log('[DistSim] Raft heartbeat tick');
      const leader = s.nodes.find(n => n.role === 'Leader' && n.status !== 'dead');
      if (!leader) {
        // Trigger election
        triggerElection();
        return;
      }

      const followers = s.nodes.filter(n => n.id !== leader.id && n.status !== 'dead');
      followers.forEach(f => {
        const link = s.links.find(l =>
          ((l.source === leader.id && l.target === f.id) || (l.source === f.id && l.target === leader.id))
          && !l.partitioned
        );
        if (link) {
          s.addPacket({ from: leader.id, to: f.id, type: 'AppendEntries', color: 'primary' });
          s.addEvent(`${leader.id} → ${f.id}: AppendEntries (log #${s.logEntries + 1})`, 'info');
        }
      });
      s.incrementLog();
    }, 1500 / speed);

    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [running, protocol, speed, getStore]);

  // Election logic
  const triggerElection = useCallback(() => {
    if (electionTimeoutRef.current) return;
    electionTimeoutRef.current = setTimeout(() => {
      const s = getStore();
      const aliveNodes = s.nodes.filter(n => n.status !== 'dead');
      if (aliveNodes.length === 0) {
        electionTimeoutRef.current = null;
        return;
      }

      // Set all alive to candidate temporarily
      useSimulationStore.setState({
        nodes: s.nodes.map(n => n.status !== 'dead' ? { ...n, status: 'candidate' as const, role: 'Candidate' as const } : n),
      });

      s.incrementTerm();
      const newTerm = s.term + 1;

      // Random winner
      const winner = aliveNodes[Math.floor(Math.random() * aliveNodes.length)];

      // Send vote request packets
      aliveNodes.forEach(n => {
        if (n.id !== winner.id) {
          s.addPacket({ from: winner.id, to: n.id, type: 'RequestVote', color: 'warning' });
        }
      });

      s.addEvent(`Election started (Term ${newTerm})`, 'warning');

      setTimeout(() => {
        const s2 = getStore();
        s2.electLeader(winner.id);
        s2.addEvent(`${winner.id} elected as Leader (Term ${newTerm})`, 'success');
        electionTimeoutRef.current = null;
      }, 2000 / speed);
    }, 2000 / speed);
  }, [getStore, speed]);

  // Messages per second tracker
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      const s = getStore();
      const count = messageCountRef.current;
      messageCountRef.current = 0;
      s.setMessagesPerSec(count);
      s.addMessageHistory({ time: Date.now(), count });
    }, 1000);
    return () => clearInterval(interval);
  }, [running, getStore]);

  // Check for leaderless state
  useEffect(() => {
    if (!running || protocol !== 'raft') return;
    const leader = nodes.find(n => n.role === 'Leader' && n.status !== 'dead');
    if (!leader && nodes.some(n => n.status !== 'dead')) {
      triggerElection();
    }
  }, [nodes, running, protocol, triggerElection]);
}
