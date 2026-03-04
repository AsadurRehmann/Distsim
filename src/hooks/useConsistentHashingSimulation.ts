import { useEffect, useRef, useCallback } from 'react';
import { useSimulationStore } from '@/store/simulationStore';

const RING_CX = 350;
const RING_CY = 300;
const RING_R = 200;

let keyCounter = 10;

function assignKeys(
  keys: { id: string; angle: number }[],
  nodeAngles: { id: string; angle: number }[]
): { id: string; angle: number; owner: string }[] {
  if (nodeAngles.length === 0) {
    return keys.map(k => ({ ...k, owner: '' }));
  }
  const sorted = [...nodeAngles].sort((a, b) => a.angle - b.angle);

  return keys.map(k => {
    // Find first node clockwise (angle >= key angle)
    const owner = sorted.find(n => n.angle > k.angle) || sorted[0];
    return { ...k, owner: owner.id };
  });
}

function nodeAnglePosition(index: number, total: number): number {
  // Evenly spaced around the ring
  return (index * (360 / total)) % 360;
}

function angleToXY(angle: number, cx = RING_CX, cy = RING_CY, r = RING_R) {
  const rad = (angle - 90) * (Math.PI / 180);
  return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r };
}

export function useConsistentHashingSimulation() {
  const getStore = useCallback(() => useSimulationStore.getState(), []);
  const { protocol, nodes, running, speed } = useSimulationStore();
  const prevProtocol = useRef(protocol);
  const initialized = useRef(false);
  const addKeyRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevDeadCount = useRef(0);
  const prevNodeCount = useRef(0);

  // Initialize when switching to consistent-hashing
  useEffect(() => {
    if (protocol === 'consistent-hashing' && prevProtocol.current !== 'consistent-hashing') {
      initialized.current = false;
    }
    prevProtocol.current = protocol;

    if (protocol !== 'consistent-hashing') {
      if (getStore().ringMode) {
        getStore().setRingMode(false);
      }
      initialized.current = false;
      return;
    }

    if (initialized.current) return;
    initialized.current = true;

    const s = getStore();
    s.setRingMode(true);
    keyCounter = 10;

    // Generate 10 keys at evenly spaced angles
    const keys: { id: string; angle: number }[] = Array.from({ length: 10 }, (_, i) => ({
      id: `K${i + 1}`,
      angle: (i * 36 + 5) % 360, // 36° apart, offset by 5°
    }));

    // Compute node angles
    const aliveNodes = s.nodes.filter(n => n.status !== 'dead');
    const angles = aliveNodes.map((n, i) => ({
      id: n.id,
      angle: nodeAnglePosition(i, aliveNodes.length),
    }));

    const assigned = assignKeys(keys, angles);
    s.setHashKeys(assigned);
    s.setNodeAngles(angles);

    // Position nodes on ring
    const updatedNodes = s.nodes.map(n => {
      const na = angles.find(a => a.id === n.id);
      if (!na) return { ...n, role: 'Node' as const };
      const pos = angleToXY(na.angle);
      return { ...n, x: pos.x, y: pos.y, status: 'healthy' as const, role: 'Node' as const };
    });
    s.setNodes(updatedNodes);

    prevDeadCount.current = s.nodes.filter(n => n.status === 'dead').length;
    prevNodeCount.current = s.nodes.length;

    s.addEvent('Consistent Hashing ring initialized with 10 keys', 'info');
  }, [protocol, getStore]);

  // Reassign on node kill/add
  useEffect(() => {
    if (protocol !== 'consistent-hashing' || !initialized.current) return;

    const s = getStore();
    const deadCount = s.nodes.filter(n => n.status === 'dead').length;
    const nodeCount = s.nodes.length;

    // Only run if something changed
    if (deadCount === prevDeadCount.current && nodeCount === prevNodeCount.current) return;

    const killedNew = deadCount > prevDeadCount.current;
    const addedNew = nodeCount > prevNodeCount.current;

    prevDeadCount.current = deadCount;
    prevNodeCount.current = nodeCount;

    const aliveNodes = s.nodes.filter(n => n.status !== 'dead');
    const angles = aliveNodes.map((n, i) => ({
      id: n.id,
      angle: nodeAnglePosition(i, aliveNodes.length),
    }));
    s.setNodeAngles(angles);

    // Reposition alive nodes
    const updatedNodes = s.nodes.map(n => {
      if (n.status === 'dead') return n;
      const na = angles.find(a => a.id === n.id);
      if (!na) return n;
      const pos = angleToXY(na.angle);
      return { ...n, x: pos.x, y: pos.y };
    });
    s.setNodes(updatedNodes);

    // Reassign keys
    const oldKeys = s.hashKeys;
    const reassigned = assignKeys(
      oldKeys.map(k => ({ id: k.id, angle: k.angle })),
      angles
    );
    s.setHashKeys(reassigned);

    // Log redistribution
    if (killedNew) {
      // Find which node was just killed
      const deadNode = s.nodes.find(n => n.status === 'dead' && oldKeys.some(k => k.owner === n.id));
      if (deadNode) {
        const movedKeys = oldKeys.filter(k => k.owner === deadNode.id);
        const newOwners = reassigned.filter(k => movedKeys.some(mk => mk.id === k.id));
        const targetNode = newOwners[0]?.owner || 'unknown';
        s.addEvent(`${deadNode.id} removed — ${movedKeys.length} keys redistributed to ${targetNode}`, 'warning');
      }
    }
    if (addedNew) {
      const newNode = aliveNodes[aliveNodes.length - 1];
      const gainedKeys = reassigned.filter(k => k.owner === newNode?.id);
      if (newNode && gainedKeys.length > 0) {
        s.addEvent(`${newNode.id} joined ring — acquired ${gainedKeys.length} keys`, 'success');
      }
    }
  }, [nodes, protocol, getStore]);

  // Periodic key addition
  useEffect(() => {
    if (!running || protocol !== 'consistent-hashing') {
      if (addKeyRef.current) clearInterval(addKeyRef.current);
      return;
    }

    addKeyRef.current = setInterval(() => {
      const s = getStore();
      if (s.protocol !== 'consistent-hashing') return;
      console.log('[DistSim] Consistent Hashing tick — adding key');

      keyCounter++;
      const newAngle = Math.random() * 360;
      const newKey = { id: `K${keyCounter}`, angle: newAngle };

      const aliveAngles = s.nodeAngles.filter(na =>
        s.nodes.some(n => n.id === na.id && n.status !== 'dead')
      );
      const assigned = assignKeys([newKey], aliveAngles);
      const owner = assigned[0]?.owner || '';

      s.setHashKeys([...s.hashKeys, { ...newKey, owner }]);
      s.addEvent(`Key K${keyCounter} added → assigned to ${owner}`, 'info');
    }, 2000 / speed);

    return () => { if (addKeyRef.current) clearInterval(addKeyRef.current); };
  }, [running, protocol, speed, getStore]);
}
