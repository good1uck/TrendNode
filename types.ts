
export interface TrendNode {
  id: string;
  label: string;
  translation: string;
  x: number;
  y: number;
  level: number;
  isSelected: boolean;
  isInitial?: boolean;
}

export interface Edge {
  id: string;
  source: string;
  target: string;
}

export interface HistoryItem {
  id: string;
  query: string;
  timestamp: number;
}
