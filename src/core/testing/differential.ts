
import type { Graph } from "../../types/graph";
import {
  DIJKSTRA_MODULE,
  FLOYD_WARSHALL_MODULE,
  runAlgorithmProcess,
} from "./algorithm-process.ts";
import type { ShortestPathInput } from "./algorithm-process.ts";

export interface ShortestPathMismatch {
  source: number;
  target: number;
  dijkstraDistance: number;
  floydWarshallDistance: number;
}

export interface ShortestPathComparisonResult {
  equivalent: boolean;
  mismatches: ShortestPathMismatch[];
}


/** compare dijkstra and floyd warshall 기능을 수행합니다. */
export function compareDijkstraAndFloydWarshall(
  graph: Graph,
  sources: number[] = Array.from({ length: graph.nodeCount }, (_, source) => source),
): ShortestPathComparisonResult {
  
  if (graph.nodeCount === 0) return { equivalent: true, mismatches: [] };

  const mismatches: ShortestPathMismatch[] = [];
  for (const source of sources) {
    
    const input: ShortestPathInput = { graph, source };
    const dijkstraDistances = runAlgorithmProcess(DIJKSTRA_MODULE, input);
    const floydWarshallDistances = runAlgorithmProcess(FLOYD_WARSHALL_MODULE, input);

    
    for (let target = 0; target < graph.nodeCount; target++) {
      const dijkstraDistance = dijkstraDistances[target]!;
      const floydWarshallDistance = floydWarshallDistances[target]!;

      if (dijkstraDistance !== floydWarshallDistance) {
        mismatches.push({
          source,
          target,
          dijkstraDistance,
          floydWarshallDistance,
        });
      }
    }
  }

  return {
    equivalent: mismatches.length === 0,
    mismatches,
  };
}
