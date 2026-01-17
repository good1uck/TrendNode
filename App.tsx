
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { TrendNode, Edge, HistoryItem } from './types';
import { fetchNewsTrends, TrendKeyword } from './services/geminiService';
import Node from './components/Node';
import HistoryPanel from './components/HistoryPanel';

// Physics constants - Refined for "liquid" smooth movement
const REPULSION_STRENGTH = 12000;
const SPRING_STRENGTH = 0.06; 
const DAMPING = 0.82; // Slightly more friction for stability
const IDEAL_DISTANCE = 240;
const CENTER_GRAVITY = 0.004;
const DRAG_THRESHOLD = 3; 

const App: React.FC = () => {
  const [nodes, setNodes] = useState<TrendNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandingNodeId, setExpandingNodeId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  
  // Dragging state
  const dragNodeIdRef = useRef<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);
  
  // Physics engine refs
  const velocitiesRef = useRef<{ [key: string]: { vx: number, vy: number } }>({});
  const animationFrameRef = useRef<number>(0);
  const nodesRef = useRef<TrendNode[]>([]);

  // Sync ref with state for physics calculations
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Physics Simulation Loop
  const updatePhysics = useCallback(() => {
    if (nodesRef.current.length === 0) return;

    const currentNodes = [...nodesRef.current];
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const newVelocities = { ...velocitiesRef.current };

    // 1. Repulsion (Collision and Spacing)
    for (let i = 0; i < currentNodes.length; i++) {
      for (let j = i + 1; j < currentNodes.length; j++) {
        const nodeA = currentNodes[i];
        const nodeB = currentNodes[j];
        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        const distanceSq = dx * dx + dy * dy || 1;
        const distance = Math.sqrt(distanceSq);
        
        const radiusA = (nodeA.isInitial || nodeA.isSelected ? 75 : 60);
        const radiusB = (nodeB.isInitial || nodeB.isSelected ? 75 : 60);
        const minDistance = radiusA + radiusB + 20;

        let force = 0;
        if (distance < minDistance) {
          // Linear push when overlapping to avoid "infinite" force at distance 0
          force = (minDistance - distance) * 0.5;
        } else {
          force = REPULSION_STRENGTH / distanceSq;
        }

        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;

        if (newVelocities[nodeA.id]) {
          newVelocities[nodeA.id].vx -= fx;
          newVelocities[nodeA.id].vy -= fy;
        }
        if (newVelocities[nodeB.id]) {
          newVelocities[nodeB.id].vx += fx;
          newVelocities[nodeB.id].vy += fy;
        }
      }
    }

    // 2. Spring Forces (Elastic Edges)
    edges.forEach(edge => {
      const source = currentNodes.find(n => n.id === edge.source);
      const target = currentNodes.find(n => n.id === edge.target);
      if (source && target) {
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (distance - IDEAL_DISTANCE) * SPRING_STRENGTH;
        
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;

        if (newVelocities[source.id]) {
          newVelocities[source.id].vx += fx;
          newVelocities[source.id].vy += fy;
        }
        if (newVelocities[target.id]) {
          newVelocities[target.id].vx -= fx;
          newVelocities[target.id].vy -= fy;
        }
      }
    });

    // 3. Center Gravity & Constraints
    currentNodes.forEach(node => {
      if (!newVelocities[node.id]) return;
      
      const dx = centerX - node.x;
      const dy = centerY - node.y;
      newVelocities[node.id].vx += dx * CENTER_GRAVITY;
      newVelocities[node.id].vy += dy * CENTER_GRAVITY;

      // Wall repulsion to keep things on screen
      if (node.x < 100) newVelocities[node.id].vx += 2;
      if (node.x > window.innerWidth - 100) newVelocities[node.id].vx -= 2;
      if (node.y < 100) newVelocities[node.id].vy += 2;
      if (node.y > window.innerHeight - 100) newVelocities[node.id].vy -= 2;
    });

    // 4. Update Positions
    const updatedNodes = currentNodes.map(node => {
      if (node.id === dragNodeIdRef.current) return node;
      
      const vel = newVelocities[node.id];
      if (!vel) return node;

      vel.vx *= DAMPING;
      vel.vy *= DAMPING;
      
      const maxSpeed = 18;
      const speed = Math.sqrt(vel.vx * vel.vx + vel.vy * vel.vy);
      if (speed > maxSpeed) {
        vel.vx = (vel.vx / speed) * maxSpeed;
        vel.vy = (vel.vy / speed) * maxSpeed;
      }

      return {
        ...node,
        x: node.x + vel.vx,
        y: node.y + vel.vy
      };
    });

    velocitiesRef.current = newVelocities;
    
    // Check if movement is significant enough to trigger state update
    let significantChange = false;
    for (let i = 0; i < updatedNodes.length; i++) {
      if (Math.abs(updatedNodes[i].x - currentNodes[i].x) > 0.05 || 
          Math.abs(updatedNodes[i].y - currentNodes[i].y) > 0.05) {
        significantChange = true;
        break;
      }
    }

    if (significantChange || dragNodeIdRef.current) {
      setNodes(updatedNodes);
    }
    animationFrameRef.current = requestAnimationFrame(updatePhysics);
  }, [edges]);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(updatePhysics);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [updatePhysics]);

  // Dragging logic
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragNodeIdRef.current) {
      const dx = Math.abs(e.clientX - dragStartPosRef.current.x);
      const dy = Math.abs(e.clientY - dragStartPosRef.current.y);
      if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
        hasMovedRef.current = true;
      }

      // Update position immediately in ref for physics loop to see
      const newX = e.clientX - dragOffsetRef.current.x;
      const newY = e.clientY - dragOffsetRef.current.y;
      
      setNodes(prev => prev.map(n => 
        n.id === dragNodeIdRef.current ? { ...n, x: newX, y: newY } : n
      ));
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    dragNodeIdRef.current = null;
  }, []);

  const handleNodeMouseDown = (e: React.MouseEvent, node: TrendNode) => {
    if (e.button !== 0) return; 
    dragNodeIdRef.current = node.id;
    dragOffsetRef.current = { x: e.clientX - node.x, y: e.clientY - node.y };
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    hasMovedRef.current = false;
    
    // Reset velocity of dragged node
    if (velocitiesRef.current[node.id]) {
      velocitiesRef.current[node.id] = { vx: 0, vy: 0 };
    }
  };

  const handleInitialInput = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = inputValue.trim();
    if (!query || loading) return;

    setLoading(true);
    const selectedNodes = nodes.filter(n => n.isSelected);
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const id = Math.random().toString(36).substr(2, 9);
    const newNode: TrendNode = {
      id,
      label: query,
      translation: query.match(/[\u4e00-\u9fa5]/) ? 'User Input' : query, 
      x: centerX + (Math.random() - 0.5) * 20,
      y: centerY + (Math.random() - 0.5) * 20,
      level: 0,
      isSelected: false,
      isInitial: nodes.length === 0,
    };
    
    velocitiesRef.current[id] = { vx: 0, vy: 0 };

    if (selectedNodes.length > 0) {
      const newEdges: Edge[] = selectedNodes.map(sn => ({
        id: `e-${sn.id}-${newNode.id}`,
        source: sn.id,
        target: newNode.id,
      }));
      
      const avgX = selectedNodes.reduce((acc, n) => acc + n.x, 0) / selectedNodes.length;
      const avgY = selectedNodes.reduce((acc, n) => acc + n.y, 0) / selectedNodes.length;
      
      newNode.x = avgX + (Math.random() - 0.5) * 50;
      newNode.y = avgY + (Math.random() - 0.5) * 50;
      newNode.level = Math.max(...selectedNodes.map(n => n.level)) + 1;
      
      setNodes(prev => [...prev, newNode]);
      setEdges(prev => [...prev, ...newEdges]);
    } else {
      setNodes([newNode]);
      setEdges([]);
    }

    setHistory(prev => [{ id: Date.now().toString(), query, timestamp: Date.now() }, ...prev]);
    setIsStarted(true);
    setInputValue('');
    setLoading(false);
  };

  const handleNodeClick = async (targetNode: TrendNode) => {
    if (loading || hasMovedRef.current) return;
    
    setLoading(true);
    setExpandingNodeId(targetNode.id);

    try {
      const trends = await fetchNewsTrends(targetNode.label);
      
      const newNodes: TrendNode[] = [];
      const newEdges: Edge[] = [];
      
      trends.forEach((trend, i) => {
        const id = Math.random().toString(36).substr(2, 9);
        const angle = (i / trends.length) * Math.PI * 2;
        
        // Place new nodes further out to reduce collision spike
        const startDist = 80; 
        const newNode: TrendNode = {
          id,
          label: trend.keyword,
          translation: trend.translation,
          x: targetNode.x + Math.cos(angle) * startDist,
          y: targetNode.y + Math.sin(angle) * startDist,
          level: targetNode.level + 1,
          isSelected: false,
        };
        
        // Give new nodes a gentle outward "pop" velocity
        const pushForce = 5;
        velocitiesRef.current[id] = { 
          vx: Math.cos(angle) * pushForce, 
          vy: Math.sin(angle) * pushForce 
        };
        
        newNodes.push(newNode);
        newEdges.push({
          id: `e-${targetNode.id}-${id}`,
          source: targetNode.id,
          target: id,
        });
      });

      setNodes(prev => [...prev, ...newNodes]);
      setEdges(prev => [...prev, ...newEdges]);
    } catch (err) {
      console.error("Failed to fetch trends:", err);
    } finally {
      setLoading(false);
      setExpandingNodeId(null);
    }
  };

  const handleNodeContextMenu = (e: React.MouseEvent, targetNode: TrendNode) => {
    e.preventDefault();
    setNodes(prev => prev.map(n => 
      n.id === targetNode.id ? { ...n, isSelected: !n.isSelected } : n
    ));
  };

  return (
    <div 
      className="relative w-screen h-screen overflow-hidden bg-white select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
        <defs>
          <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00000044" />
            <stop offset="100%" stopColor="#fbbf2444" />
          </linearGradient>
        </defs>
        {edges.map(edge => {
          const source = nodes.find(n => n.id === edge.source);
          const target = nodes.find(n => n.id === edge.target);
          if (!source || !target) return null;
          
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const tension = Math.max(0.2, Math.min(2.5, IDEAL_DISTANCE / dist));
          const opacity = Math.max(0.1, Math.min(0.6, 0.4 * tension));
          
          return (
            <line
              key={edge.id}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke="url(#edgeGradient)"
              strokeWidth={1.5 * tension}
              strokeOpacity={opacity}
              strokeDasharray={target.level > 2 ? "4,4" : "0"}
            />
          );
        })}
      </svg>

      <div className="absolute inset-0 z-20 overflow-visible">
        {nodes.map(node => (
          <Node
            key={node.id}
            node={node}
            onClick={() => handleNodeClick(node)}
            onContextMenu={(e) => handleNodeContextMenu(e, node)}
            onMouseDown={(e) => handleNodeMouseDown(e, node)}
            isLoading={expandingNodeId === node.id}
          />
        ))}
      </div>

      <div className="absolute top-6 right-6 z-40">
        <button 
          onClick={() => setIsHistoryOpen(true)}
          className="glass p-4 rounded-full hover:bg-black hover:text-white transition-all duration-300 shadow-xl border border-black/5"
          title="View History"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>

      <HistoryPanel 
        history={history} 
        isOpen={isHistoryOpen} 
        onClose={() => setIsHistoryOpen(false)} 
      />

      <div className={`fixed left-1/2 -translate-x-1/2 transition-all duration-700 ease-in-out z-50 
        ${isStarted ? 'bottom-10' : 'top-1/2 -translate-y-1/2'}`}
      >
        <form onSubmit={handleInitialInput} className="relative group">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={nodes.length > 0 ? (nodes.filter(n=>n.isSelected).length > 0 ? "Connect to selection..." : "Enter keyword...") : "Enter a news trend keyword..."}
            className="w-[450px] h-16 px-10 rounded-full glass border-2 border-black/10 focus:border-yellow-400 outline-none text-lg shadow-2xl transition-all font-medium text-black placeholder:text-gray-400"
          />
          <button
            type="submit"
            disabled={loading}
            className={`absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center transition-all
              ${loading && !expandingNodeId ? 'bg-gray-100' : 'bg-black text-yellow-400 hover:scale-110 active:scale-95 shadow-lg'}
            `}
          >
            {loading && !expandingNodeId ? (
              <svg className="animate-spin h-5 w-5 text-gray-400" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            )}
          </button>
        </form>
      </div>

      {!isStarted && (
        <div className="absolute top-[62%] left-1/2 -translate-x-1/2 text-center pointer-events-none">
          <p className="text-black/60 font-semibold text-lg tracking-tight">AI News Trend Divergence Tool</p>
          <p className="text-[11px] text-black/30 mt-3 tracking-[0.3em] uppercase font-bold">Intelligent Graphing • Smooth Expansion</p>
        </div>
      )}

      {isStarted && nodes.length < 5 && (
        <div className="absolute bottom-4 left-4 text-[10px] text-gray-400 bg-white/50 px-3 py-1 rounded-full border border-black/5 animate-pulse">
          Drag Nodes to explore • Right-click to select • Click to expand
        </div>
      )}
    </div>
  );
};

export default App;
