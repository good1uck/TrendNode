
import React from 'react';
import { HistoryItem } from '../types';

interface HistoryPanelProps {
  history: HistoryItem[];
  isOpen: boolean;
  onClose: () => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, isOpen, onClose }) => {
  return (
    <div 
      className={`fixed top-0 right-0 h-full w-80 glass z-50 transform transition-transform duration-300 ease-in-out shadow-2xl
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}
    >
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-black">History</h2>
          <button onClick={onClose} className="text-black hover:bg-black/10 p-2 rounded-full">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="space-y-4 overflow-y-auto h-[calc(100vh-120px)] pr-2">
          {history.length === 0 ? (
            <p className="text-gray-400 italic text-center">No history yet</p>
          ) : (
            history.map((item) => (
              <div key={item.id} className="p-3 bg-white/50 rounded-xl border border-white/20 hover:bg-white/80 transition-colors">
                <div className="font-medium text-black">{item.query}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(item.timestamp).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryPanel;
