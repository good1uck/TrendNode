
import React from 'react';
import { TrendNode } from '../types';

interface NodeProps {
  node: TrendNode;
  onClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  isLoading?: boolean;
}

const Node: React.FC<NodeProps> = ({ node, onClick, onContextMenu, onMouseDown, isLoading }) => {
  const isLarge = node.isInitial || node.isSelected;
  const size = isLarge ? 140 : 115;
  
  // Define border and background styles based on state
  let stateStyles = "border border-black/10 hover:border-black/30 bg-white/40";
  if (node.isSelected) {
    stateStyles = "border-2 border-yellow-400 bg-yellow-400/30 shadow-lg shadow-yellow-400/20";
  } else if (node.isInitial) {
    stateStyles = "border-2 border-black bg-white/60 shadow-xl";
  }

  return (
    <div
      style={{
        left: node.x - size / 2,
        top: node.y - size / 2,
        width: size,
        height: size,
      }}
      onMouseDown={onMouseDown}
      className={`absolute rounded-full glass flex flex-col items-center justify-center p-3 cursor-grab active:cursor-grabbing select-none z-30
        ${stateStyles}
        ${isLoading ? 'loading-node scale-110 z-50 !border-transparent' : 'hover:scale-105 active:scale-95'}
      `}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <div className="text-sm font-bold text-black text-center leading-tight break-words overflow-hidden line-clamp-3 w-full px-1">
        {node.label}
      </div>
      <div className="text-[9px] text-gray-600 text-center mt-1 italic uppercase tracking-tighter leading-none break-words line-clamp-2 w-full px-1 opacity-80">
        {node.translation}
      </div>
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
           <svg className="animate-spin h-5 w-5 text-black/40" viewBox="0 0 24 24">
              <circle className="opacity-10" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
           </svg>
        </div>
      )}
    </div>
  );
};

export default Node;
