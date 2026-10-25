



export interface Edge {
  
  from: number;
  to: number;
  weight: number;
}

export interface Graph {
  
  nodeCount: number;
  
  directed: boolean;
  
  edges: Edge[];
}
