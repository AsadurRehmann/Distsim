import { useEffect, useRef, useCallback } from 'react';
import { useSimulationStore } from '@/store/simulationStore';

export function useTwoPhaseCommitSimulation() {
  const getStore = useCallback(() => useSimulationStore.getState(), []);
  const { protocol } = useSimulationStore();
  const phaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize when switching to 2pc
  useEffect(() => {
    if (protocol !== '2pc') return;
    const s = getStore();
    const updated = s.nodes.map((n, i) => {
      const status = n.status === 'dead' ? 'dead' as const : 'healthy' as const;
      const role = i === 0 ? 'Coordinator' as const : 'Participant' as const;
      return { ...n, status, role };
    });
    useSimulationStore.setState({
      nodes: updated,
      tpcPhase: 'idle' as const,
      tpcVotes: {},
    });
    s.addEvent('Two-Phase Commit protocol active — N1 is Coordinator', 'info');
  }, [protocol, getStore]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (phaseTimeoutRef.current) clearTimeout(phaseTimeoutRef.current);
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    };
  }, []);
}

// Standalone function called by the store's beginTransaction action
export function runTransaction(getState: () => ReturnType<typeof useSimulationStore.getState>) {
  const s = getState();
  if (s.protocol !== '2pc') return;
  if (s.tpcPhase !== 'idle') return;
  console.log('[DistSim] 2PC transaction started');

  const coordinator = s.nodes.find(n => n.role === 'Coordinator' && n.status !== 'dead');
  if (!coordinator) {
    s.addEvent('❌ No alive Coordinator — cannot begin transaction', 'danger');
    return;
  }

  const participants = s.nodes.filter(n => n.role === 'Participant' && n.status !== 'dead');
  if (participants.length === 0) {
    s.addEvent('❌ No alive Participants — cannot begin transaction', 'danger');
    return;
  }

  // Initialize votes
  const votes: Record<string, 'yes' | 'no' | 'pending'> = {};
  participants.forEach(p => { votes[p.id] = 'pending'; });

  useSimulationStore.setState({ tpcPhase: 'prepare', tpcVotes: votes });
  s.addEvent(`📋 PHASE 1: Coordinator ${coordinator.id} sending PREPARE to ${participants.length} participants`, 'warning');

  // Send PREPARE packets
  participants.forEach(p => {
    const link = s.links.find(l =>
      ((l.source === coordinator.id && l.target === p.id) || (l.source === p.id && l.target === coordinator.id))
      && !l.partitioned
    );
    if (link) {
      s.addPacket({ from: coordinator.id, to: p.id, type: '2PC-PREPARE', color: 'warning' });
    }
  });

  // After packets arrive (~1.5s), participants vote
  const speed = s.speed;
  setTimeout(() => {
    const s2 = getState();
    if (s2.protocol !== '2pc' || s2.tpcPhase !== 'prepare') return;

    const coord = s2.nodes.find(n => n.role === 'Coordinator' && n.status !== 'dead');
    const newVotes: Record<string, 'yes' | 'no' | 'pending'> = { ...s2.tpcVotes };
    const participantNodes = s2.nodes.filter(n => n.role === 'Participant');

    participantNodes.forEach(p => {
      if (newVotes[p.id] === undefined) return; // wasn't part of this round
      if (p.status === 'dead') {
        newVotes[p.id] = 'no';
        s2.addEvent(`${p.id} is DEAD — treated as NO vote`, 'danger');
        return;
      }
      // 90% YES, 10% NO
      const vote = Math.random() < 0.9 ? 'yes' : 'no';
      newVotes[p.id] = vote as 'yes' | 'no';
      s2.addEvent(`${p.id} votes ${vote.toUpperCase()}`, vote === 'yes' ? 'success' : 'danger');

      // Send vote reply packet back to coordinator (if coord alive)
      if (coord) {
        s2.addPacket({
          from: p.id,
          to: coord.id,
          type: `2PC-${vote.toUpperCase()}`,
          color: vote === 'yes' ? 'success' : 'destructive',
        });
      }
    });

    useSimulationStore.setState({ tpcVotes: newVotes });

    // Check if coordinator died during Phase 1
    if (!coord) {
      // Coordinator dead — participants that voted YES are BLOCKED
      s2.addEvent('💀 Coordinator died during PREPARE — participants BLOCKED', 'danger');
      const blockedNodes = s2.nodes.map(n => {
        if (n.role === 'Participant' && n.status !== 'dead' && newVotes[n.id] === 'yes') {
          return { ...n, status: 'waiting' as const };
        }
        return n;
      });
      useSimulationStore.setState({ nodes: blockedNodes, tpcPhase: 'blocked' });

      // Log blocked nodes
      blockedNodes.filter(n => n.status === 'waiting').forEach(n => {
        s2.addEvent(`⏳ ${n.id} BLOCKED — awaiting coordinator`, 'warning');
      });

      // Reset after 5s
      setTimeout(() => {
        const s3 = getState();
        if (s3.tpcPhase === 'blocked') {
          const resetNodes = s3.nodes.map(n =>
            n.status === 'waiting' ? { ...n, status: 'healthy' as const } : n
          );
          useSimulationStore.setState({ nodes: resetNodes, tpcPhase: 'idle', tpcVotes: {} });
          s3.addEvent('Transaction timed out — participants released from BLOCKED state', 'info');
        }
      }, 5000 / speed);

      return;
    }

    // Phase 2: after vote replies arrive (~1.5s more)
    setTimeout(() => {
      const s3 = getState();
      if (s3.protocol !== '2pc' || (s3.tpcPhase !== 'prepare')) return;

      const coord3 = s3.nodes.find(n => n.role === 'Coordinator' && n.status !== 'dead');
      if (!coord3) {
        // Coordinator died between phases
        s3.addEvent('💀 Coordinator died before Phase 2 — participants BLOCKED', 'danger');
        const blockedNodes = s3.nodes.map(n => {
          if (n.role === 'Participant' && n.status !== 'dead' && s3.tpcVotes[n.id] === 'yes') {
            return { ...n, status: 'waiting' as const };
          }
          return n;
        });
        useSimulationStore.setState({ nodes: blockedNodes, tpcPhase: 'blocked' });
        blockedNodes.filter(n => n.status === 'waiting').forEach(n => {
          s3.addEvent(`⏳ ${n.id} BLOCKED — awaiting coordinator`, 'warning');
        });
        setTimeout(() => {
          const s4 = getState();
          if (s4.tpcPhase === 'blocked') {
            const resetNodes = s4.nodes.map(n =>
              n.status === 'waiting' ? { ...n, status: 'healthy' as const } : n
            );
            useSimulationStore.setState({ nodes: resetNodes, tpcPhase: 'idle', tpcVotes: {} });
            s4.addEvent('Transaction timed out — participants released', 'info');
          }
        }, 5000 / speed);
        return;
      }

      const allYes = Object.values(s3.tpcVotes).every(v => v === 'yes');

      if (allYes) {
        // COMMIT
        useSimulationStore.setState({ tpcPhase: 'commit' });
        s3.addEvent(`✅ PHASE 2: All voted YES — Coordinator sending COMMIT`, 'success');
        const aliveParticipants = s3.nodes.filter(n => n.role === 'Participant' && n.status !== 'dead');
        aliveParticipants.forEach(p => {
          s3.addPacket({ from: coord3.id, to: p.id, type: '2PC-COMMIT', color: 'success' });
        });
      } else {
        // ABORT
        useSimulationStore.setState({ tpcPhase: 'abort' });
        const noVoters = Object.entries(s3.tpcVotes).filter(([, v]) => v === 'no').map(([id]) => id);
        s3.addEvent(`❌ PHASE 2: ${noVoters.join(', ')} voted NO — Coordinator sending ABORT`, 'danger');
        const aliveParticipants = s3.nodes.filter(n => n.role === 'Participant' && n.status !== 'dead');
        aliveParticipants.forEach(p => {
          s3.addPacket({ from: coord3.id, to: p.id, type: '2PC-ABORT', color: 'destructive' });
        });
      }

      // Reset after 5s
      setTimeout(() => {
        const s4 = getState();
        if (s4.tpcPhase === 'commit' || s4.tpcPhase === 'abort') {
          useSimulationStore.setState({ tpcPhase: 'idle', tpcVotes: {} });
          s4.addEvent('Transaction complete — ready for next round', 'info');
        }
      }, 5000 / speed);

    }, 1500 / speed);
  }, 1500 / speed);
}
