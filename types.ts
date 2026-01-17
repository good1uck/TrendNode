
export interface TrendNode {
  id: string;
  label: string;
  translation: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  level: number;
  isSelected: boolean;
  isInitial?: boolean;
  weight?: number; // 1-10 scale for news recency/importance
}

export interface Edge {
  id: string;
  source: string | any;
  target: string | any;
}

export interface HistoryItem {
  id: string;
  query: string;
  timestamp: number;
  nodes: TrendNode[];
  edges: Edge[];
}
