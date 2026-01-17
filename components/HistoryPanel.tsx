
import React from 'react';
import { HistoryItem } from '../types';

interface HistoryPanelProps {
  history: HistoryItem[];
  isOpen: boolean;
  onClose: () => void;
  onHistoryClick: (item: HistoryItem) => void;
  currentHistoryId: string | null;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, isOpen, onClose, onHistoryClick, currentHistoryId }) => {
  return (
    <div 
      className={`fixed top-0 right-0 h-full w-80 glass z-50 transform transition-transform duration-300 ease-in-out shadow-2xl
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}
    >
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-black">Trend History</h2>
          <button onClick={onClose} className="text-black hover:bg-black/10 p-2 rounded-full transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="space-y-3 overflow-y-auto h-[calc(100vh-120px)] pr-2 custom-scrollbar">
          {history.length === 0 ? (
            <p className="text-gray-400 italic text-center py-10">No search sessions yet</p>
          ) : (
            history.map((item) => (
              <button 
                key={item.id} 
                onClick={() => onHistoryClick(item)}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 group
                  ${currentHistoryId === item.id 
                    ? 'bg-black text-white border-black shadow-lg' 
                    : 'bg-white/50 border-white/20 hover:bg-white hover:border-black/10 hover:shadow-md'
                  }
                `}
              >
                <div className="flex justify-between items-start">
                  <div className={`font-bold truncate pr-2 ${currentHistoryId === item.id ? 'text-yellow-400' : 'text-black'}`}>
                    {item.query}
                  </div>
                  <div className={`text-[10px] whitespace-nowrap ${currentHistoryId === item.id ? 'text-gray-400' : 'text-gray-500'}`}>
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className={`text-[10px] mt-2 flex items-center gap-2 ${currentHistoryId === item.id ? 'text-gray-300' : 'text-gray-500'}`}>
                   <span>{item.nodes.length} Nodes</span>
                   <span className="opacity-30">•</span>
                   <span>{item.edges.length} Edges</span>
                </div>
                <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center text-[10px] font-bold uppercase tracking-widest text-yellow-500">
                  Switch to Canvas →
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryPanel;
