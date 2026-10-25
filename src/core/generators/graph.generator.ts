

import type { Edge, Graph } from "../../types/graph.ts";

export interface RandomGraphOptions {
  
  nodeCount: number;
  
  edgeCount?: number;
  directed?: boolean;
  minWeight?: number;
  maxWeight?: number;
  
  seed?: number;
  
  allowSelfLoops?: boolean;
}


/** generate random graph 기능을 수행합니다. */
export function generateRandomGraph(options: RandomGraphOptions): Graph {
  
  const {
    nodeCount,
    directed = false,
    minWeight = 1,
    maxWeight = 10,
    seed = Math.floor(Math.random() * 0x1_0000_0000),
    allowSelfLoops = false,
  } = options;

  if (!Number.isInteger(nodeCount) || nodeCount < 0) {
    throw new RangeError("nodeCount must be a non-negative integer");
  }
  if (!Number.isInteger(minWeight) || !Number.isInteger(maxWeight) || minWeight > maxWeight) {
    throw new RangeError("minWeight and maxWeight must be integers with minWeight <= maxWeight");
  }
  if (!Number.isInteger(seed)) {
    throw new RangeError("seed must be an integer");
  }

  
  const possibleEdgeCount = directed
    ? nodeCount * (nodeCount - (allowSelfLoops ? 0 : 1))
    : (nodeCount * (nodeCount - 1)) / 2 + (allowSelfLoops ? nodeCount : 0);
  const edgeCount = options.edgeCount ?? Math.min(nodeCount * 2, possibleEdgeCount);

  if (!Number.isInteger(edgeCount) || edgeCount < 0 || edgeCount > possibleEdgeCount) {
    throw new RangeError(`edgeCount must be an integer between 0 and ${possibleEdgeCount}`);
  }

  const random = createSeededRandom(seed);
  const edges: Edge[] = [];
  const pairs: Array<[number, number]> = [];

  for (let from = 0; from < nodeCount; from++) {
    const firstTo = directed ? 0 : from;
    for (let to = firstTo; to < nodeCount; to++) {
      if (!allowSelfLoops && from === to) continue;
      
      if (!directed && to < from) continue;
      pairs.push([from, to]);
    }
  }

  
  for (let i = 0; i < edgeCount; i++) {
    const selectedIndex = i + Math.floor(random() * (pairs.length - i));
    const pair = pairs[selectedIndex];
    if (!pair) continue;
    [pairs[i], pairs[selectedIndex]] = [pair, pairs[i]!];
    edges.push({
      from: pair[0],
      to: pair[1],
      weight: minWeight + Math.floor(random() * (maxWeight - minWeight + 1)),
    });
  }

  return { nodeCount, directed, edges };
}

/** create seeded random 기능을 수행합니다. */
function createSeededRandom(seed: number): () => number {
  
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}
