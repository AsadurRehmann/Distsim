import { useSimulationStore } from '@/store/simulationStore';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Separator } from '@/components/ui/separator';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { ChevronRight, ChevronLeft } from 'lucide-react';

const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 180;
const MAX_WIDTH = 480;

export function RightSidebar() {
  const { protocol, term, logEntries, messagesPerSec, messageHistory, events, nodes, gossipConverged, hashKeys, tpcPhase, tpcVotes, concurrentNodes } = useSimulationStore();
  const logRef = useRef<HTMLDivElement>(null);

  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [collapsed, setCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isHandleHovered, setIsHandleHovered] = useState(false);
  const prevWidthRef = useRef(DEFAULT_WIDTH);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const startX = e.clientX;
    const startWidth = collapsed ? 0 : width;

    const onMouseMove = (e: MouseEvent) => {
      const delta = startX - e.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
      setWidth(newWidth);
      if (collapsed) setCollapsed(false);
    };

    const onMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width, collapsed]);

  const toggleCollapse = useCallback(() => {
    if (collapsed) {
      setCollapsed(false);
      setWidth(prevWidthRef.current);
    } else {
      prevWidthRef.current = width;
      setCollapsed(true);
    }
  }, [collapsed, width]);

  const leader = nodes.find(n => n.role === 'Leader' && n.status !== 'dead');
  const isCompact = width <= MIN_WIDTH && !collapsed;
  const actualWidth = collapsed ? 0 : width;

  return (
    <div className="relative flex h-full" style={{ width: actualWidth, minWidth: 0 }}>
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 h-full z-10 flex flex-col items-center"
        style={{ width: 12, marginLeft: -6 }}
      >
        {/* Collapse button */}
        <button
          onClick={toggleCollapse}
          className="relative z-20 mt-2 w-5 h-5 rounded-sm flex items-center justify-center bg-surface border border-border hover:border-primary hover:bg-primary/10 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronLeft className="w-3 h-3 text-primary" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted-foreground hover:text-primary" />
          )}
        </button>

        {/* Drag bar */}
        <div
          onMouseDown={handleMouseDown}
          onMouseEnter={() => setIsHandleHovered(true)}
          onMouseLeave={() => setIsHandleHovered(false)}
          className="flex-1 flex items-center justify-center"
          style={{
            width: 12,
            cursor: 'col-resize',
          }}
        >
          <div
            className="h-full transition-all duration-150"
            style={{
              width: isDragging || isHandleHovered ? 4 : 2,
              backgroundColor: isDragging
                ? 'hsl(190, 100%, 50%)'
                : isHandleHovered
                ? 'hsl(190, 100%, 50%)'
                : 'hsl(210, 30%, 16%)',
              borderRadius: 2,
              boxShadow: isDragging || isHandleHovered
                ? '0 0 8px 1px hsl(190 100% 50% / 0.3)'
                : 'none',
            }}
          />
        </div>
      </div>

      {/* Sidebar content */}
      {!collapsed && (
        <div
          className="bg-card border-l border-border flex flex-col h-full overflow-hidden"
          style={{ width: actualWidth }}
        >
          {/* Metrics */}
          {!isCompact && (
            <div className="p-4 border-b border-border">
              <h2 className="text-[10px] font-mono text-muted-foreground tracking-widest mb-3">SYSTEM METRICS</h2>

              {protocol === 'raft' && (
                <div className="space-y-2">
                  <MetricRow label="Leader" value={leader?.id || 'None'} color={leader ? 'text-success' : 'text-destructive'} />
                  <MetricRow label="Term" value={`${term}`} />
                  <MetricRow label="Log Entries" value={`${logEntries}`} />
                  <MetricRow label="Messages/sec" value={`${messagesPerSec}`} color="text-primary" />
                </div>
              )}

              {protocol === 'gossip' && (() => {
                const alive = nodes.filter(n => n.status !== 'dead');
                const withValue = alive.filter(n => n.gossipValue != null);
                return (
                  <div className="space-y-2">
                    <MetricRow label="Nodes Alive" value={`${alive.length}`} />
                    <MetricRow label="Infected" value={`${withValue.length}/${alive.length}`} color={gossipConverged ? 'text-success' : 'text-warning'} />
                    <MetricRow label="Converged" value={gossipConverged ? 'Yes' : 'No'} color={gossipConverged ? 'text-success' : 'text-muted-foreground'} />
                  </div>
                );
              })()}

              {protocol === 'consistent-hashing' && (() => {
                const alive = nodes.filter(n => n.status !== 'dead');
                return (
                  <div className="space-y-2">
                    <MetricRow label="Ring Nodes" value={`${alive.length}`} />
                    <MetricRow label="Total Keys" value={`${hashKeys.length}`} color="text-primary" />
                    <MetricRow label="Avg Keys/Node" value={alive.length > 0 ? `${(hashKeys.length / alive.length).toFixed(1)}` : '0'} />
                  </div>
                );
              })()}

              {protocol === 'vector-clocks' && (() => {
                const alive = nodes.filter(n => n.status !== 'dead');
                const totalEvents = alive.reduce((sum, n) => sum + (n.vectorClock?.[nodes.indexOf(n)] || 0), 0);
                return (
                  <div className="space-y-2">
                    <MetricRow label="Nodes Alive" value={`${alive.length}`} />
                    <MetricRow label="Total Events" value={`${totalEvents}`} color="text-primary" />
                    <MetricRow label="Concurrent" value={concurrentNodes.length > 0 ? 'Detected' : 'None'} color={concurrentNodes.length > 0 ? 'text-warning' : 'text-muted-foreground'} />
                  </div>
                );
              })()}

              {protocol === '2pc' && (() => {
                const coord = nodes.find(n => n.role === 'Coordinator');
                const yesCount = Object.values(tpcVotes).filter(v => v === 'yes').length;
                const noCount = Object.values(tpcVotes).filter(v => v === 'no').length;
                const waitingCount = nodes.filter(n => n.status === 'waiting').length;
                return (
                  <div className="space-y-2">
                    <MetricRow label="Coordinator" value={coord && coord.status !== 'dead' ? coord.id : 'DEAD'} color={coord && coord.status !== 'dead' ? 'text-success' : 'text-destructive'} />
                    <MetricRow label="Phase" value={tpcPhase.toUpperCase()} color={tpcPhase === 'commit' ? 'text-success' : tpcPhase === 'abort' ? 'text-destructive' : tpcPhase === 'blocked' ? 'text-warning' : 'text-primary'} />
                    {tpcPhase !== 'idle' && <MetricRow label="Votes" value={`${yesCount}Y / ${noCount}N`} />}
                    {waitingCount > 0 && <MetricRow label="Blocked" value={`${waitingCount}`} color="text-warning" />}
                  </div>
                );
              })()}

              {/* Chart — only for raft */}
              {protocol === 'raft' && (
                <div className="mt-3 h-20">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={messageHistory.slice(-30)}>
                      <XAxis dataKey="time" hide />
                      <YAxis hide domain={[0, 'auto']} />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="hsl(190, 100%, 50%)"
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Compact metrics row */}
          {isCompact && (
            <div className="px-3 py-2 border-b border-border flex items-center gap-3 text-[10px] font-mono flex-wrap">
              {protocol === 'raft' && (
                <>
                  <span className="text-muted-foreground">L:</span>
                  <span className={leader ? 'text-success' : 'text-destructive'}>{leader?.id || '—'}</span>
                  <span className="text-muted-foreground">T:{term}</span>
                  <span className="text-primary">{messagesPerSec}/s</span>
                </>
              )}
              {protocol === 'gossip' && (
                <span className={gossipConverged ? 'text-success' : 'text-warning'}>{gossipConverged ? '✓ Converged' : 'Spreading...'}</span>
              )}
              {protocol === 'consistent-hashing' && (
                <span className="text-primary">{hashKeys.length} keys</span>
              )}
              {protocol === 'vector-clocks' && (
                <span className="text-primary">{nodes.filter(n => n.status !== 'dead').length} nodes</span>
              )}
              {protocol === '2pc' && (
                <span className={tpcPhase === 'commit' ? 'text-success' : tpcPhase === 'abort' ? 'text-destructive' : 'text-primary'}>{tpcPhase.toUpperCase()}</span>
              )}
            </div>
          )}

          {/* Event Log */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 py-2">
              <div className="flex items-center gap-2">
                <Separator className="flex-1 bg-border" />
                <span className="text-[10px] font-mono text-muted-foreground tracking-widest whitespace-nowrap">EVENT LOG</span>
                <Separator className="flex-1 bg-border" />
              </div>
            </div>
            <div ref={logRef} className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-thin">
              <div className="space-y-1">
                {events.map(e => (
                  <div key={e.id} className={`font-mono leading-relaxed ${isCompact ? 'text-[10px]' : 'text-[11px]'}`}>
                    {!isCompact && (
                      <span className="text-muted-foreground">[{formatTime(e.time)}] </span>
                    )}
                    <span className={
                      e.type === 'success' ? 'text-success' :
                      e.type === 'danger' ? 'text-destructive' :
                      e.type === 'warning' ? 'text-warning' :
                      'text-foreground'
                    }>
                      {e.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricRow({ label, value, color = 'text-foreground' }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[11px] font-mono text-muted-foreground">{label}</span>
      <span className={`text-sm font-mono font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const sec = String(totalSec % 60).padStart(2, '0');
  const milli = String(Math.floor(ms % 1000)).padStart(3, '0');
  return `${min}:${sec}.${milli}`;
}
