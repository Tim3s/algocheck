
import { dijkstra, floydWarshall } from "../algorithms/index.ts";
import { generateRandomGraph } from "../generators/graph.generator.ts";
import { compareDijkstraAndFloydWarshall } from "./differential.ts";

export interface RandomShortestPathFlowOptions {
  nodeCounts?: number[];
  
  runs?: number;
  
  edgeFactor?: number;
  seed?: number;
  directed?: boolean;
}

export interface RandomShortestPathFlowResult {
  
  seed: number;
  nodeCount: number;
  edgeCount: number;
  runs: number;
  equivalent: boolean;
  mismatchCount: number;
  dijkstraAverageMs: number;
  dijkstraMedianMs: number;
  floydWarshallAverageMs: number;
  floydWarshallMedianMs: number;
}


/** run random shortest path flow 기능을 수행합니다. */
export function runRandomShortestPathFlow(
  options: RandomShortestPathFlowOptions = {},
): RandomShortestPathFlowResult[] {
  
  const {
    nodeCounts = [10, 50, 100, 200],
    runs = 10,
    edgeFactor = 4,
    seed = 1,
    directed = false,
  } = options;

  if (!Number.isInteger(runs) || runs < 10) {
    throw new RangeError("runs must be an integer greater than or equal to 10");
  }
  if (!Number.isFinite(edgeFactor) || edgeFactor < 0) {
    throw new RangeError("edgeFactor must be a non-negative number");
  }

  
  const results = nodeCounts.map((nodeCount, index) => {
    if (!Number.isInteger(nodeCount) || nodeCount < 1) {
      throw new RangeError("each nodeCount must be a positive integer");
    }

    const graphSeed = seed + index;
    const maxEdges = directed
      ? nodeCount * (nodeCount - 1)
      : (nodeCount * (nodeCount - 1)) / 2;
    const graph = generateRandomGraph({
      nodeCount,
      edgeCount: Math.min(Math.floor(nodeCount * edgeFactor), maxEdges),
      directed,
      minWeight: 1,
      maxWeight: 100,
      seed: graphSeed,
    });

    
    const comparison = compareDijkstraAndFloydWarshall(graph, [0]);
    const dijkstraSamples = measureRepeated(runs, () => dijkstra(graph, 0));
    const floydWarshallSamples = measureRepeated(runs, () => floydWarshall(graph, 0));

    if (!comparison.equivalent) {
      console.error(`Mismatch: seed=${graphSeed}, nodeCount=${nodeCount}, directed=${directed}`);
      console.error(comparison.mismatches);
    }

    return {
      seed: graphSeed,
      nodeCount,
      edgeCount: graph.edges.length,
      runs,
      equivalent: comparison.equivalent,
      mismatchCount: comparison.mismatches.length,
      dijkstraAverageMs: average(dijkstraSamples),
      dijkstraMedianMs: median(dijkstraSamples),
      floydWarshallAverageMs: average(floydWarshallSamples),
      floydWarshallMedianMs: median(floydWarshallSamples),
    };
  });

  console.table(results);
  return results;
}

/** measure repeated 기능을 수행합니다. */
function measureRepeated(runs: number, operation: () => void): number[] {
  operation(); 
  const samples: number[] = [];

  
  for (let run = 0; run < runs; run++) {
    const start = performance.now();
    operation();
    samples.push(performance.now() - start);
  }

  return samples;
}

/** average 기능을 수행합니다. */
function average(samples: number[]): number {
  
  return samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
}

/** median 기능을 수행합니다. */
function median(samples: number[]): number {
  
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}
