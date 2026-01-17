
import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { TrendNode, Edge, HistoryItem } from './types';
import { fetchNewsTrends } from './services/geminiService';
import Node from './components/Node';
import HistoryPanel from './components/HistoryPanel';

// Constants
const IDEAL_DISTANCE = 220;
const DRAG_THRESHOLD = 3; 
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;
const ZOOM_SENSITIVITY = 0.001;

const App: React.FC = () => {
  // State
  const [nodes, setNodes] = useState<TrendNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isInitialSearching, setIsInitialSearching] = useState(false);
  const [expandingNodeIds, setExpandingNodeIds] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, k: 1 });

  // Refs
  const simulationRef = useRef<d3.Simulation<any, undefined> | null>(null);
  const dragNodeRef = useRef<TrendNode | null>(null);
  const isPanningRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);

  // Initialize and update D3 Simulation
  useEffect(() => {
    if (!simulationRef.current) {
      simulationRef.current = d3.forceSimulation()
        .force("link", d3.forceLink().id((d: any) => d.id).distance(IDEAL_DISTANCE).strength(0.8))
        .force("charge", d3.forceManyBody().strength(-1800).distanceMax(1000))
        .force("x", d3.forceX(window.innerWidth / 2).strength(0.06))
        .force("y", d3.forceY(window.innerHeight / 2).strength(0.06))
        .force("collide", d3.forceCollide().radius((d: any) => {
          const isLarge = d.isInitial || d.isSelected;
          const baseSize = isLarge ? 90 : 75;
          return baseSize + (d.weight ? d.weight * 2.5 : 10);
        }).iterations(4))
        .alphaDecay(0.02); // Slower decay for smoother settling

      simulationRef.current.on("tick", () => {
        // Essential: Trigger React re-render without deep cloning
        setNodes(prev => [...prev]);
      });
    }

    const sim = simulationRef.current;
    
    // Maintain simulation energy if nodes are expanding or being dragged
    if (expandingNodeIds.size > 0 || dragNodeRef.current) {
      sim.alphaTarget(0.1).restart();
    } else {
      sim.alphaTarget(0);
    }

    // Sync structural data
    sim.nodes(nodes as any);
    const nodeIds = new Set(nodes.map(n => n.id));
    const validLinks = edges
      .map(e => ({ ...e }))
      .filter(link => {
        const s = typeof link.source === 'object' ? link.source.id : link.source;
        const t = typeof link.target === 'object' ? link.target.id : link.target;
        return nodeIds.has(s) && nodeIds.has(t);
      });
    (sim.force("link") as d3.ForceLink<any, any>).links(validLinks);

    // Re-heat simulation on structure change
    if (nodes.length > 0) {
      sim.alpha(Math.max(sim.alpha(), 0.3)).restart();
    }

    return () => {
      if (expandingNodeIds.size === 0 && !dragNodeRef.current) sim.stop();
    };
  }, [nodes.length, edges.length, expandingNodeIds.size]); 

  // Handle zooming
  const handleWheel = (e: React.WheelEvent) => {
    const delta = -e.deltaY * ZOOM_SENSITIVITY;
    const newK = Math.min(Math.max(viewTransform.k + delta, MIN_ZOOM), MAX_ZOOM);
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    const worldX = (mouseX - viewTransform.x) / viewTransform.k;
    const worldY = (mouseY - viewTransform.y) / viewTransform.k;
    const newX = mouseX - worldX * newK;
    const newY = mouseY - worldY * newK;
    setViewTransform({ x: newX, y: newY, k: newK });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (dragNodeRef.current || e.button === 1) return;
    isPanningRef.current = true;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    panOffsetRef.current = { x: viewTransform.x, y: viewTransform.y };
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragNodeRef.current) {
      const dx = Math.abs(e.clientX - dragStartPosRef.current.x);
      const dy = Math.abs(e.clientY - dragStartPosRef.current.y);
      if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) hasMovedRef.current = true;
      
      const worldX = (e.clientX - viewTransform.x) / viewTransform.k;
      const worldY = (e.clientY - viewTransform.y) / viewTransform.k;
      dragNodeRef.current.fx = worldX;
      dragNodeRef.current.fy = worldY;
      simulationRef.current?.alphaTarget(0.1).restart();
    } else if (isPanningRef.current) {
      const dx = e.clientX - dragStartPosRef.current.x;
      const dy = e.clientY - dragStartPosRef.current.y;
      setViewTransform(prev => ({ ...prev, x: panOffsetRef.current.x + dx, y: panOffsetRef.current.y + dy }));
    }
  }, [viewTransform]);

  const handleMouseUp = useCallback(() => {
    if (dragNodeRef.current) {
      dragNodeRef.current.fx = null;
      dragNodeRef.current.fy = null;
      dragNodeRef.current = null;
      simulationRef.current?.alphaTarget(0);
    }
    isPanningRef.current = false;
  }, []);

  const handleNodeMouseDown = (e: React.MouseEvent, node: TrendNode) => {
    e.stopPropagation(); 
    if (e.button !== 0) return;
    dragNodeRef.current = node;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    hasMovedRef.current = false;
  };

  const handleInitialInput = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = inputValue.trim();
    if (!query || isInitialSearching) return;

    setIsInitialSearching(true);
    const nodeId = Math.random().toString(36).substr(2, 9);
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    setNodes(prevNodes => {
      const selectedOnes = prevNodes.filter(n => n.isSelected);
      const newNode: TrendNode = {
        id: nodeId,
        label: query,
        translation: query.match(/[\u4e00-\u9fa5]/) ? 'Processing...' : query, 
        x: centerX + (Math.random() - 0.5) * 40,
        y: centerY + (Math.random() - 0.5) * 40,
        level: selectedOnes.length > 0 ? Math.max(...selectedOnes.map(n => n.level)) + 1 : 0,
        isSelected: false,
        isInitial: prevNodes.length === 0,
        weight: 10,
      };

      const nextNodes = selectedOnes.length > 0 ? [...prevNodes, newNode] : [newNode];
      const nextEdges = selectedOnes.length > 0 
        ? [...edges, ...selectedOnes.map(sn => ({ id: `e-${sn.id}-${nodeId}`, source: sn.id, target: nodeId }))]
        : [];
      
      setEdges(nextEdges);
      const histId = Date.now().toString();
      setHistory(h => [{ id: histId, query, timestamp: Date.now(), nodes: nextNodes, edges: nextEdges }, ...h]);
      setCurrentHistoryId(histId);
      
      if (prevNodes.length === 0) setViewTransform({ x: 0, y: 0, k: 1 });
      return nextNodes;
    });

    setIsStarted(true);
    setInputValue('');
    setIsInitialSearching(false);
  };

  const handleNodeClick = async (targetNode: TrendNode) => {
    if (hasMovedRef.current || expandingNodeIds.has(targetNode.id)) return;
    
    // Atomic expansion state update
    setExpandingNodeIds(prev => new Set(prev).add(targetNode.id));

    try {
      const trends = await fetchNewsTrends(targetNode.label);
      if (trends.length === 0) throw new Error("No trends found");

      const newNodes: TrendNode[] = trends.map((trend, i) => {
        const angle = (i / trends.length) * Math.PI * 2;
        const dist = 50;
        return {
          id: Math.random().toString(36).substr(2, 9),
          label: trend.keyword,
          translation: trend.translation,
          weight: trend.weight,
          x: targetNode.x + Math.cos(angle) * dist,
          y: targetNode.y + Math.sin(angle) * dist,
          level: targetNode.level + 1,
          isSelected: false,
        };
      });

      setNodes(currentNodes => {
        const nextNodes = [...currentNodes, ...newNodes];
        setEdges(currentEdges => {
          const nextEdges = [...currentEdges, ...newNodes.map(nn => ({ id: `e-${targetNode.id}-${nn.id}`, source: targetNode.id, target: nn.id }))];
          if (currentHistoryId) {
            setHistory(h => h.map(item => item.id === currentHistoryId ? { ...item, nodes: nextNodes, edges: nextEdges } : item));
          }
          return nextEdges;
        });
        return nextNodes;
      });

    } catch (err) {
      console.error("Expand failed:", err);
    } finally {
      setExpandingNodeIds(prev => {
        const next = new Set(prev);
        next.delete(targetNode.id);
        return next;
      });
    }
  };

  const handleHistoryClick = (item: HistoryItem) => {
    simulationRef.current?.stop();
    simulationRef.current = null;
    setNodes(item.nodes.map(n => ({ ...n, fx: null, fy: null })));
    setEdges(item.edges);
    setCurrentHistoryId(item.id);
    setIsStarted(true);
    setIsHistoryOpen(false);
    setViewTransform({ x: 0, y: 0, k: 1 });
  };

  const handleNodeContextMenu = (e: React.MouseEvent, targetNode: TrendNode) => {
    e.preventDefault();
    e.stopPropagation();
    setNodes(prev => {
      const nextNodes = prev.map(n => n.id === targetNode.id ? { ...n, isSelected: !n.isSelected } : n);
      if (currentHistoryId) {
        setHistory(h => h.map(item => item.id === currentHistoryId ? { ...item, nodes: nextNodes } : item));
      }
      return nextNodes;
    });
  };

  const handleNodeMiddleClick = (node: TrendNode) => {
    window.open(`https://www.google.com/search?q=${encodeURIComponent(node.label)}`, '_blank');
  };

  return (
    <div 
      className="relative w-screen h-screen overflow-hidden bg-white select-none cursor-grab active:cursor-grabbing" 
      onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onMouseDown={handleMouseDown} onWheel={handleWheel}
    >
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: `${40 * viewTransform.k}px ${40 * viewTransform.k}px`, backgroundPosition: `${viewTransform.x}px ${viewTransform.y}px` }} 
      />

      <div className="absolute inset-0 z-10" style={{ transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.k})`, transformOrigin: '0 0' }}>
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00000022" />
              <stop offset="100%" stopColor="#fbbf2444" />
            </linearGradient>
          </defs>
          {edges.map(edge => {
            const sId = typeof edge.source === 'object' ? edge.source.id : edge.source;
            const tId = typeof edge.target === 'object' ? edge.target.id : edge.target;
            const s = nodes.find(n => n.id === sId);
            const t = nodes.find(n => n.id === tId);
            if (!s || !t) return null;
            const isFlowing = expandingNodeIds.has(s.id) || expandingNodeIds.has(t.id);
            return (
              <line key={edge.id} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="url(#edgeGradient)" 
                strokeWidth={isFlowing ? 3 : 1.5} strokeOpacity={isFlowing ? 1 : 0.4} className={isFlowing ? "line-flowing" : ""} 
              />
            );
          })}
        </svg>

        <div className="absolute inset-0 overflow-visible">
          {nodes.map(node => (
            <Node key={node.id} node={node} onClick={() => handleNodeClick(node)} onContextMenu={(e) => handleNodeContextMenu(e, node)} 
              onMiddleClick={handleNodeMiddleClick} onMouseDown={(e) => handleNodeMouseDown(e, node)} isLoading={expandingNodeIds.has(node.id)} 
            />
          ))}
        </div>
      </div>

      <div className="absolute top-6 right-6 z-40">
        <button onMouseDown={(e) => e.stopPropagation()} onClick={() => setIsHistoryOpen(true)} 
          className="glass p-4 rounded-full hover:bg-black hover:text-white transition-all shadow-xl border border-black/5"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>

      <HistoryPanel history={history} isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} onHistoryClick={handleHistoryClick} currentHistoryId={currentHistoryId} />

      <div className={`fixed left-1/2 -translate-x-1/2 transition-all duration-700 ease-in-out z-50 ${isStarted ? 'bottom-10' : 'top-1/2 -translate-y-1/2'}`}>
        <form onSubmit={handleInitialInput} onMouseDown={(e) => e.stopPropagation()} className="relative group">
          <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} 
            placeholder={nodes.length > 0 ? (nodes.some(n=>n.isSelected) ? "Connect news..." : "Explore new trend...") : "Search breaking news..."} 
            className="w-[480px] h-16 px-10 rounded-full glass border-2 border-black/10 focus:border-yellow-400 outline-none text-lg shadow-2xl transition-all font-medium text-black" 
          />
          <button type="submit" disabled={isInitialSearching} className={`absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center transition-all ${isInitialSearching ? 'bg-gray-100' : 'bg-black text-yellow-400 hover:scale-110 shadow-lg'}`}>
            {isInitialSearching ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-black/20 border-t-black" /> : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>}
          </button>
        </form>
      </div>

      {!isStarted && (
        <div className="absolute top-[62%] left-1/2 -translate-x-1/2 text-center pointer-events-none">
          <p className="text-black/60 font-semibold text-xl tracking-tight">TrendNode AI</p>
          <p className="text-[10px] text-black/30 mt-3 tracking-[0.4em] uppercase font-bold">Deep News Divergence Engine</p>
        </div>
      )}
    </div>
  );
};

export default App;
