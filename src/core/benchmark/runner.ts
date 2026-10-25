
import { dijkstra, floydWarshall } from "../algorithms/index.ts";
import { generateRandomGraph } from "../generators/graph.generator.ts";

export interface ShortestPathBenchmarkOptions {
  
  nodeCounts?: number[];
  
  runs?: number;
  
  edgeFactor?: number;
  
  seed?: number;
}

export interface ShortestPathBenchmarkResult {
  nodeCount: number;
  edgeCount: number;
  runs: number;
  
  sourceVertices: number[];
  
  dijkstraAverageMs: number;
  dijkstraMedianMs: number;
  floydWarshallAverageMs: number;
  floydWarshallMedianMs: number;
}


/** benchmark shortest paths 기능을 수행합니다. */
export function benchmarkShortestPaths(
  options: ShortestPathBenchmarkOptions = {},
): ShortestPathBenchmarkResult[] {
  
  const {
    nodeCounts = [10, 50, 100, 200],
    runs = 10,
    edgeFactor = 4,
    seed = 1,
  } = options;

  if (!Number.isInteger(runs) || runs < 10) {
    throw new RangeError("runs must be an integer greater than or equal to 10");
  }
  if (!Number.isFinite(edgeFactor) || edgeFactor < 0) {
    throw new RangeError("edgeFactor must be a non-negative number");
  }

  return nodeCounts.map((nodeCount, index) => {
    if (!Number.isInteger(nodeCount) || nodeCount < 1) {
      throw new RangeError("each nodeCount must be a positive integer");
    }

    const maxEdges = (nodeCount * (nodeCount - 1)) / 2;
    const edgeCount = Math.min(Math.floor(nodeCount * edgeFactor), maxEdges);
    const graph = generateRandomGraph({
      nodeCount,
      edgeCount,
      directed: false,
      minWeight: 1,
      maxWeight: 100,
      seed: seed + index,
    });
    const dijkstraTimes: number[] = [];
    const floydWarshallTimes: number[] = [];
    const sourceVertices: number[] = [];
    
    const nextSource = createSeededRandom(seed ^ Math.imul(index + 1, 0x9e3779b1));

    
    dijkstra(graph, 0);
    floydWarshall(graph, 0);

    for (let run = 0; run < runs; run++) {
      const source = Math.floor(nextSource() * nodeCount);
      sourceVertices.push(source);

      
      if (run % 2 === 0) {
        dijkstraTimes.push(timeDijkstra(graph, source));
        floydWarshallTimes.push(timeFloydWarshall(graph, source));
      } else {
        floydWarshallTimes.push(timeFloydWarshall(graph, source));
        dijkstraTimes.push(timeDijkstra(graph, source));
      }
    }

    const dijkstraSummary = summarize(dijkstraTimes);
    const floydWarshallSummary = summarize(floydWarshallTimes);

    return {
      nodeCount,
      edgeCount,
      runs,
      sourceVertices,
      dijkstraAverageMs: dijkstraSummary.averageMs,
      dijkstraMedianMs: dijkstraSummary.medianMs,
      floydWarshallAverageMs: floydWarshallSummary.averageMs,
      floydWarshallMedianMs: floydWarshallSummary.medianMs,
    };
  });
}

/** time dijkstra 기능을 수행합니다. */
function timeDijkstra(graph: Parameters<typeof dijkstra>[0], source: number): number {
  const start = performance.now();
  dijkstra(graph, source);
  return performance.now() - start;
}

/** time floyd warshall 기능을 수행합니다. */
function timeFloydWarshall(graph: Parameters<typeof floydWarshall>[0], source: number): number {
  const start = performance.now();
  floydWarshall(graph, source);
  return performance.now() - start;
}

/** summarize 기능을 수행합니다. */
function summarize(samplesMs: number[]): { averageMs: number; medianMs: number } {
  
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const medianMs = sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;

  return {
    averageMs: samplesMs.reduce((sum, sample) => sum + sample, 0) / samplesMs.length,
    medianMs,
  };
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
