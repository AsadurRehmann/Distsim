import { useRef, useCallback, useState } from 'react';
import { useSimulationStore } from '@/store/simulationStore';
import { motion, AnimatePresence } from 'framer-motion';

export function SimCanvas() {
  const { nodes, links, packets, interactionMode, connectSource, protocol, gossipConverged, hashKeys, nodeAngles, ringMode, concurrentNodes, tpcPhase, tpcVotes, updateNodePosition, handleNodeClick, handleLinkClick, killNode, partitionLink, addEvent, setInteractionMode } = useSimulationStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [dyingNodes, setDyingNodes] = useState<Set<string>>(new Set());
  const [partitioningLinks, setPartitioningLinks] = useState<Set<string>>(new Set());

  const getNodeById = useCallback((id: string) => nodes.find(n => n.id === id), [nodes]);

  const getSvgPoint = useCallback((e: React.MouseEvent) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const triggerKillAnimation = useCallback((nodeId: string) => {
    setDyingNodes(prev => new Set(prev).add(nodeId));
    // After flash animation (3 flashes × 200ms = 600ms), apply the kill
    setTimeout(() => {
      killNode(nodeId);
      setDyingNodes(prev => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    }, 700);
    setInteractionMode('none');
  }, [killNode, setInteractionMode]);

  const triggerPartitionAnimation = useCallback((linkId: string) => {
    setPartitioningLinks(prev => new Set(prev).add(linkId));
    setTimeout(() => {
      partitionLink(linkId);
      setPartitioningLinks(prev => {
        const next = new Set(prev);
        next.delete(linkId);
        return next;
      });
    }, 600);
    setInteractionMode('none');
  }, [partitionLink, setInteractionMode]);

  const handleMouseDown = useCallback((nodeId: string, e: React.MouseEvent) => {
    if (interactionMode === 'kill') {
      const node = getNodeById(nodeId);
      if (node && node.status !== 'dead') {
        triggerKillAnimation(nodeId);
      }
      return;
    }
    if (interactionMode === 'connect') {
      handleNodeClick(nodeId);
      return;
    }
    if (interactionMode !== 'none') return;
    if (ringMode) return; // No dragging in ring mode
    const node = getNodeById(nodeId);
    if (!node) return;
    const pt = getSvgPoint(e);
    if (!pt) return;
    dragRef.current = {
      id: nodeId,
      offsetX: pt.x - node.x,
      offsetY: pt.y - node.y,
    };
    e.preventDefault();
  }, [interactionMode, handleNodeClick, getNodeById, getSvgPoint, triggerKillAnimation]);

  const onLinkClick = useCallback((linkId: string) => {
    if (interactionMode === 'partition') {
      const link = links.find(l => l.id === linkId);
      if (link && !link.partitioned) {
        triggerPartitionAnimation(linkId);
      } else {
        handleLinkClick(linkId);
      }
      return;
    }
    handleLinkClick(linkId);
  }, [interactionMode, links, triggerPartitionAnimation, handleLinkClick]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const pt = getSvgPoint(e);
    if (!pt) return;
    setMousePos(pt);
    if (!dragRef.current) return;
    const x = pt.x - dragRef.current.offsetX;
    const y = pt.y - dragRef.current.offsetY;
    updateNodePosition(dragRef.current.id, Math.max(30, x), Math.max(30, y));
  }, [updateNodePosition, getSvgPoint]);

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const statusColor = (status: string) => {
    switch (status) {
      case 'leader': return 'hsl(190, 100%, 50%)';
      case 'follower': case 'healthy': return 'hsl(152, 100%, 50%)';
      case 'dead': return 'hsl(350, 90%, 60%)';
      case 'candidate': return 'hsl(40, 100%, 50%)';
      case 'waiting': return 'hsl(40, 100%, 50%)';
      default: return 'hsl(190, 100%, 50%)';
    }
  };

  const packetColor = (color: string) => {
    switch (color) {
      case 'primary': return 'hsl(190, 100%, 50%)';
      case 'success': return 'hsl(152, 100%, 50%)';
      case 'destructive': return 'hsl(350, 90%, 60%)';
      case 'warning': return 'hsl(40, 100%, 50%)';
      default: return 'hsl(190, 100%, 50%)';
    }
  };

  const connectSourceNode = connectSource ? getNodeById(connectSource) : null;
  const isConnectMode = interactionMode === 'connect';
  const isKillMode = interactionMode === 'kill';
  const isPartitionMode = interactionMode === 'partition';

  const canvasBorderClass = isKillMode
    ? 'ring-2 ring-destructive/60 animate-danger-pulse'
    : isPartitionMode
    ? 'ring-2 ring-warning/60 animate-warning-pulse'
    : '';

  return (
    <div className={`flex-1 bg-background dot-grid relative overflow-hidden transition-shadow ${canvasBorderClass}`}
      style={{ cursor: isKillMode ? 'crosshair' : isPartitionMode ? 'crosshair' : undefined }}
    >
      <svg
        ref={svgRef}
        className="w-full h-full"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { handleMouseUp(); setMousePos(null); }}
        style={{ cursor: isKillMode ? 'crosshair' : isPartitionMode ? 'crosshair' : undefined }}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-strong">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Consistent Hashing Ring */}
        {protocol === 'consistent-hashing' && ringMode && (() => {
          const CX = 350, CY = 300, R = 200;
          // Node color palette for ownership
          const nodeColors: Record<string, string> = {};
          const palette = [
            'hsl(190, 100%, 50%)', 'hsl(152, 100%, 50%)', 'hsl(40, 100%, 50%)',
            'hsl(280, 70%, 60%)', 'hsl(350, 85%, 55%)', 'hsl(200, 90%, 55%)',
            'hsl(120, 70%, 50%)', 'hsl(30, 90%, 55%)',
          ];
          const aliveAngles = nodeAngles
            .filter(na => nodes.some(n => n.id === na.id && n.status !== 'dead'))
            .sort((a, b) => a.angle - b.angle);
          aliveAngles.forEach((na, i) => { nodeColors[na.id] = palette[i % palette.length]; });

          // Build arc segments for ownership zones
          const arcSegments: { startAngle: number; endAngle: number; nodeId: string }[] = [];
          if (aliveAngles.length > 0) {
            for (let i = 0; i < aliveAngles.length; i++) {
              const curr = aliveAngles[i];
              const prev = aliveAngles[(i - 1 + aliveAngles.length) % aliveAngles.length];
              // This node owns from prev's angle to its own angle (clockwise)
              const start = prev.angle;
              const end = curr.angle;
              arcSegments.push({ startAngle: start, endAngle: end, nodeId: curr.id });
            }
          }

          function describeArc(startAngle: number, endAngle: number, r: number): string {
            let sweep = endAngle - startAngle;
            if (sweep <= 0) sweep += 360;
            const largeArc = sweep > 180 ? 1 : 0;
            const s = ((startAngle - 90) * Math.PI) / 180;
            const e = ((endAngle - 90) * Math.PI) / 180;
            const x1 = CX + Math.cos(s) * r, y1 = CY + Math.sin(s) * r;
            const x2 = CX + Math.cos(e) * r, y2 = CY + Math.sin(e) * r;
            return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
          }

          return (
            <g>
              {/* Ring circle */}
              <circle
                cx={CX} cy={CY} r={R}
                fill="none"
                stroke="hsl(190, 100%, 50%)"
                strokeWidth={1.5}
                strokeDasharray="6 4"
                opacity={0.3}
              />
              {/* Ownership arc segments */}
              {arcSegments.map((seg, i) => (
                <path
                  key={`arc-${i}`}
                  d={describeArc(seg.startAngle, seg.endAngle, R)}
                  fill="none"
                  stroke={nodeColors[seg.nodeId] || 'hsl(210, 30%, 20%)'}
                  strokeWidth={4}
                  opacity={0.2}
                  strokeLinecap="round"
                />
              ))}
              {/* Key dots on ring */}
              {hashKeys.map(key => {
                const rad = (key.angle - 90) * (Math.PI / 180);
                const kx = CX + Math.cos(rad) * R;
                const ky = CY + Math.sin(rad) * R;
                const ownerColor = nodeColors[key.owner] || 'hsl(210, 30%, 40%)';
                return (
                  <motion.g key={key.id}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  >
                    <circle
                      cx={kx} cy={ky} r={4}
                      fill={ownerColor}
                      stroke="hsl(212, 28%, 6%)"
                      strokeWidth={1.5}
                      filter="url(#glow)"
                    />
                    <text
                      x={kx} y={ky + (ky < CY ? -10 : 12)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={ownerColor}
                      fontSize={6}
                      fontFamily="JetBrains Mono"
                      opacity={0.6}
                    >
                      {key.id}
                    </text>
                  </motion.g>
                );
              })}
            </g>
          );
        })()}

        {/* Links (hide in ring mode) */}
        {!ringMode && links.map(link => {
          const source = getNodeById(link.source);
          const target = getNodeById(link.target);
          if (!source || !target) return null;
          const midX = (source.x + target.x) / 2;
          const midY = (source.y + target.y) / 2;
          const isPartitioning = partitioningLinks.has(link.id);
          const isLinkHovered = hoveredLink === link.id && isPartitionMode;

          return (
            <g key={link.id} onClick={() => onLinkClick(link.id)} className="cursor-pointer"
              onMouseEnter={() => setHoveredLink(link.id)}
              onMouseLeave={() => setHoveredLink(null)}
            >
              {/* Partition flash animation overlay */}
              {isPartitioning && (
                <motion.line
                  x1={source.x} y1={source.y}
                  x2={target.x} y2={target.y}
                  stroke="hsl(350, 90%, 60%)"
                  strokeWidth={4}
                  filter="url(#glow-strong)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0, 1, 0, 1, 0] }}
                  transition={{ duration: 0.6, times: [0, 0.14, 0.28, 0.42, 0.57, 0.71, 1] }}
                />
              )}
              {/* Hover highlight for partition mode */}
              {isLinkHovered && !link.partitioned && (
                <line
                  x1={source.x} y1={source.y}
                  x2={target.x} y2={target.y}
                  stroke="hsl(350, 90%, 60%)"
                  strokeWidth={3}
                  opacity={0.3}
                  filter="url(#glow)"
                  pointerEvents="none"
                />
              )}
              <line
                x1={source.x} y1={source.y}
                x2={target.x} y2={target.y}
                stroke={link.partitioned ? 'hsl(350, 90%, 60%)' : link.latency > 0 ? 'hsl(40, 100%, 50%)' : isLinkHovered ? 'hsl(350, 90%, 40%)' : 'hsl(210, 30%, 20%)'}
                strokeWidth={link.partitioned ? 1.5 : 1}
                strokeDasharray={link.partitioned ? '6 4' : link.latency > 0 ? '4 2' : 'none'}
                className={!link.partitioned ? '' : 'animate-dash-flow'}
              />
              <line
                x1={source.x} y1={source.y}
                x2={target.x} y2={target.y}
                stroke="transparent"
                strokeWidth={12}
              />
              {link.partitioned && (
                <text x={midX} y={midY} textAnchor="middle" dominantBaseline="middle" className="text-sm" fill="hsl(350, 90%, 60%)">
                  ⚡
                </text>
              )}
              {link.latency > 0 && !link.partitioned && (
                <g className="cursor-default">
                  <rect x={midX - 22} y={midY - 9} width={44} height={18} rx={3} fill="hsl(212, 28%, 10%)" stroke="hsl(40, 100%, 50%)" strokeWidth={0.5} />
                  <text x={midX} y={midY + 1} textAnchor="middle" dominantBaseline="middle" fill="hsl(40, 100%, 50%)" fontSize={9} fontFamily="JetBrains Mono">
                    {link.latency === Infinity ? '∞' : `${link.latency}ms`}
                  </text>
                  <title>{link.latency === Infinity ? 'Infinite latency — packets will never arrive' : `Added latency: ${link.latency}ms delay per packet on ${link.source} ↔ ${link.target}`}</title>
                </g>
              )}
            </g>
          );
        })}

        {/* Connect mode preview line */}
        {isConnectMode && connectSourceNode && mousePos && (
          <line
            x1={connectSourceNode.x}
            y1={connectSourceNode.y}
            x2={mousePos.x}
            y2={mousePos.y}
            stroke="hsl(190, 100%, 50%)"
            strokeWidth={1.5}
            strokeDasharray="6 4"
            opacity={0.6}
            filter="url(#glow)"
            pointerEvents="none"
          />
        )}

        {/* Packets */}
        <AnimatePresence>
          {packets.map(pkt => {
            const from = getNodeById(pkt.from);
            const to = getNodeById(pkt.to);
            if (!from || !to) return null;
            const x = from.x + (to.x - from.x) * pkt.progress;
            const y = from.y + (to.y - from.y) * pkt.progress;
            return (
              <motion.circle
                key={pkt.id}
                cx={x}
                cy={y}
                r={4}
                fill={packetColor(pkt.color)}
                filter="url(#glow)"
                initial={{ opacity: 0, r: 0 }}
                animate={{ opacity: pkt.fade ?? 1, r: 4 }}
                exit={{ opacity: 0, r: 0 }}
              />
            );
          })}
        </AnimatePresence>

        {/* Nodes */}
        {nodes.map(node => {
          const isDead = node.status === 'dead';
          const isDying = dyingNodes.has(node.id);
          const isConcurrent = concurrentNodes.includes(node.id);
          const color = isDying ? 'hsl(350, 90%, 60%)' : statusColor(node.status);
          const isHovered = hoveredNode === node.id;
          const isSelected = connectSource === node.id;
          const showCyanHighlight = isConnectMode && (isHovered || isSelected);
          const showKillHighlight = isKillMode && isHovered && !isDead;
          const ringColor = showCyanHighlight ? 'hsl(190, 100%, 50%)' : showKillHighlight ? 'hsl(350, 90%, 60%)' : isConcurrent ? 'hsl(40, 100%, 50%)' : color;

          return (
            <g
              key={node.id}
              onMouseDown={(e) => handleMouseDown(node.id, e)}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{
                cursor: isKillMode ? 'crosshair' : isPartitionMode ? 'default' : isConnectMode ? 'pointer' : dragRef.current ? 'grabbing' : 'grab'
              }}
            >
              {/* Concurrent event amber glow */}
              {isConcurrent && !isDead && (
                <motion.circle
                  cx={node.x} cy={node.y} r={44}
                  fill="none"
                  stroke="hsl(40, 100%, 50%)"
                  strokeWidth={3}
                  filter="url(#glow-strong)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.8, 0.3, 0.8, 0] }}
                  transition={{ duration: 1.5 }}
                />
              )}
              {/* Kill hover red pulse ring */}
              {showKillHighlight && !isDying && (
                <motion.circle
                  cx={node.x} cy={node.y} r={42}
                  fill="none"
                  stroke="hsl(350, 90%, 60%)"
                  strokeWidth={2}
                  filter="url(#glow-strong)"
                  initial={{ opacity: 0.2 }}
                  animate={{ opacity: [0.2, 0.6, 0.2] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}
              {/* Death flash animation */}
              {isDying && (
                <motion.circle
                  cx={node.x} cy={node.y} r={38}
                  fill="none"
                  stroke="hsl(350, 90%, 60%)"
                  strokeWidth={4}
                  filter="url(#glow-strong)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0, 1, 0, 1, 0] }}
                  transition={{ duration: 0.7, times: [0, 0.14, 0.28, 0.42, 0.57, 0.71, 1] }}
                />
              )}
              {/* Hover/select highlight ring */}
              {showCyanHighlight && (
                <circle
                  cx={node.x} cy={node.y} r={40}
                  fill="none"
                  stroke="hsl(190, 100%, 50%)"
                  strokeWidth={2}
                  opacity={isSelected ? 0.8 : 0.4}
                  filter="url(#glow-strong)"
                />
              )}
              {/* Glow ring */}
              <motion.circle
                cx={node.x} cy={node.y} r={34}
                fill="none"
                stroke={ringColor}
                strokeWidth={2}
                opacity={isDead ? 0.3 : showCyanHighlight ? 0.9 : 0.6}
                filter="url(#glow)"
                animate={isDying ? { opacity: [0.6, 0.1] } : {}}
                transition={isDying ? { duration: 0.7 } : {}}
              />
              {/* Node body */}
              <motion.circle
                cx={node.x} cy={node.y} r={30}
                fill={isDead ? 'hsl(212, 20%, 8%)' : 'hsl(212, 28%, 10%)'}
                stroke={ringColor}
                strokeWidth={isDead ? 1 : 2}
                animate={isDying ? { opacity: [1, 0.5], fill: 'hsl(212, 20%, 8%)' } : { opacity: isDead ? 0.5 : 1 }}
                transition={isDying ? { duration: 0.7 } : {}}
              />
              {/* ID */}
              <motion.text
                x={node.x} y={node.y - 6}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={isDead || isDying ? 'hsl(210, 15%, 40%)' : 'hsl(210, 20%, 85%)'}
                fontSize={14}
                fontFamily="JetBrains Mono"
                fontWeight={600}
                animate={isDying ? { opacity: [1, 0] } : {}}
                transition={isDying ? { duration: 0.5, delay: 0.2 } : {}}
              >
                {isDead ? '💀' : isDying ? node.id : node.id}
              </motion.text>
              {/* Skull fade-in for dying nodes */}
              {isDying && (
                <motion.text
                  x={node.x} y={node.y - 4}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={18}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.4 }}
                >
                  💀
                </motion.text>
              )}
              {/* Role badge */}
              <motion.text
                x={node.x} y={node.y + 12}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={ringColor}
                fontSize={8}
                fontFamily="JetBrains Mono"
                opacity={isDead ? 0.3 : 0.8}
                animate={isDying ? { opacity: 0 } : {}}
                transition={isDying ? { duration: 0.3 } : {}}
              >
                {node.role}
              </motion.text>
              {/* Gossip value badge */}
              {protocol === 'gossip' && !isDead && !isDying && (
                <g>
                  <rect
                    x={node.x + 20} y={node.y - 28}
                    width={22} height={16} rx={3}
                    fill={node.gossipValue ? 'hsl(152, 100%, 50%)' : 'hsl(212, 28%, 14%)'}
                    fillOpacity={node.gossipValue ? 0.2 : 0.8}
                    stroke={node.gossipValue ? 'hsl(152, 100%, 50%)' : 'hsl(210, 30%, 25%)'}
                    strokeWidth={0.5}
                  />
                  <text
                    x={node.x + 31} y={node.y - 19}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={node.gossipValue ? 'hsl(152, 100%, 50%)' : 'hsl(210, 15%, 40%)'}
                    fontSize={9}
                    fontFamily="JetBrains Mono"
                    fontWeight={600}
                  >
                    {node.gossipValue ?? '—'}
                  </text>
                </g>
              )}
              {/* Consistent Hashing key count badge */}
              {protocol === 'consistent-hashing' && !isDead && !isDying && (
                (() => {
                  const keyCount = hashKeys.filter(k => k.owner === node.id).length;
                  return (
                    <g>
                      <rect
                        x={node.x + 20} y={node.y - 28}
                        width={38} height={16} rx={3}
                        fill="hsl(190, 100%, 50%)"
                        fillOpacity={0.15}
                        stroke="hsl(190, 100%, 50%)"
                        strokeWidth={0.5}
                      />
                      <text
                        x={node.x + 39} y={node.y - 19}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="hsl(190, 100%, 50%)"
                        fontSize={8}
                        fontFamily="JetBrains Mono"
                        fontWeight={600}
                      >
                        {keyCount} keys
                      </text>
                    </g>
                  );
                })()
              )}
              {/* Vector Clock badge */}
              {protocol === 'vector-clocks' && !isDead && !isDying && node.vectorClock && (
                (() => {
                  const clockStr = `[${node.vectorClock.join(',')}]`;
                  const badgeWidth = Math.max(40, clockStr.length * 6 + 8);
                  return (
                    <g>
                      <rect
                        x={node.x - badgeWidth / 2} y={node.y - 52}
                        width={badgeWidth} height={16} rx={3}
                        fill={isConcurrent ? 'hsl(40, 100%, 50%)' : 'hsl(190, 100%, 50%)'}
                        fillOpacity={0.15}
                        stroke={isConcurrent ? 'hsl(40, 100%, 50%)' : 'hsl(190, 100%, 50%)'}
                        strokeWidth={0.5}
                      />
                      <text
                        x={node.x} y={node.y - 43}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={isConcurrent ? 'hsl(40, 100%, 50%)' : 'hsl(190, 100%, 50%)'}
                        fontSize={8}
                        fontFamily="JetBrains Mono"
                        fontWeight={600}
                      >
                        {clockStr}
                      </text>
                    </g>
                  );
                })()
              )}
              {/* 2PC role & vote badge */}
              {protocol === '2pc' && !isDead && !isDying && (
                (() => {
                  const vote = tpcVotes[node.id];
                  const isWaiting = node.status === 'waiting';
                  const isCoord = node.role === 'Coordinator';
                  const badgeText = isCoord
                    ? (tpcPhase === 'idle' ? 'COORD' : tpcPhase === 'prepare' ? 'PREPARING' : tpcPhase === 'commit' ? 'COMMITTED' : tpcPhase === 'abort' ? 'ABORTED' : 'COORD')
                    : isWaiting ? 'WAITING...' : vote === 'yes' ? 'YES' : vote === 'no' ? 'NO' : 'READY';
                  const badgeColor = isCoord
                    ? 'hsl(190, 100%, 50%)'
                    : isWaiting ? 'hsl(40, 100%, 50%)' : vote === 'yes' ? 'hsl(152, 100%, 50%)' : vote === 'no' ? 'hsl(350, 90%, 60%)' : 'hsl(210, 20%, 50%)';
                  const badgeWidth = Math.max(38, badgeText.length * 6 + 10);
                  return (
                    <g>
                      <rect
                        x={node.x - badgeWidth / 2} y={node.y - 52}
                        width={badgeWidth} height={16} rx={3}
                        fill={badgeColor}
                        fillOpacity={0.15}
                        stroke={badgeColor}
                        strokeWidth={0.5}
                      />
                      <text
                        x={node.x} y={node.y - 43}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={badgeColor}
                        fontSize={7}
                        fontFamily="JetBrains Mono"
                        fontWeight={600}
                      >
                        {badgeText}
                      </text>
                      {/* Spinning amber ring for WAITING */}
                      {isWaiting && (
                        <motion.circle
                          cx={node.x} cy={node.y} r={36}
                          fill="none"
                          stroke="hsl(40, 100%, 50%)"
                          strokeWidth={2}
                          strokeDasharray="12 8"
                          filter="url(#glow)"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                          style={{ transformOrigin: `${node.x}px ${node.y}px` }}
                        />
                      )}
                    </g>
                  );
                })()
              )}
            </g>
          );
        })}

        {/* Gossip CONVERGED badge */}
        {protocol === 'gossip' && gossipConverged && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.7, 1] }}
            transition={{ duration: 0.8 }}
          >
            <rect
              x={250} y={30}
              width={160} height={32} rx={6}
              fill="hsl(152, 100%, 50%)"
              fillOpacity={0.12}
              stroke="hsl(152, 100%, 50%)"
              strokeWidth={1.5}
              filter="url(#glow)"
            />
            <text
              x={330} y={49}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="hsl(152, 100%, 50%)"
              fontSize={13}
              fontFamily="JetBrains Mono"
              fontWeight={700}
            >
              ✓ CONVERGED
            </text>
          </motion.g>
        )}
      </svg>

      {/* Interaction mode indicator */}
      {interactionMode !== 'none' && (
        <motion.div
          className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-md bg-surface border border-border font-mono text-xs"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <span className={
            interactionMode === 'kill' ? 'text-destructive' :
            interactionMode === 'partition' ? 'text-warning' :
            interactionMode === 'connect' ? 'text-primary' :
            'text-warning'
          }>
            {interactionMode === 'kill' && '💀 Click a node to kill it'}
            {interactionMode === 'connect' && (connectSource ? `🔗 Click second node (from ${connectSource})` : '🔗 Click first node to connect')}
            {interactionMode === 'partition' && '⚡ Click a link to partition'}
            {interactionMode === 'latency' && '⏱ Click a link to add latency'}
          </span>
        </motion.div>
      )}
    </div>
  );
}
