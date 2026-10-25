

import type { Graph } from "../../../types/graph.ts";
import { runTextStdioIfMain } from "./stdio.ts";

/** floyd warshall 기능을 수행합니다. */
export function floydWarshall(graph: Graph, source: number): number[] {
  const { nodeCount, edges } = graph;

  if (!Number.isInteger(source) || source < 0 || source >= nodeCount) {
    throw new RangeError("source must be an integer within the graph's vertex range");
  }

  
  const dist: number[][] = Array.from(
    { length: nodeCount },
    (_, i) =>
      Array.from(
        { length: nodeCount },
        (_, j) => (i === j ? 0 : Infinity)
      )
  );

  
  for (const edge of edges) {
    const { from, to, weight } = edge;
    dist[from][to] = Math.min(
      dist[from][to],
      weight
    );

    if (!graph.directed) {
      dist[to][from] = Math.min(
        dist[to][from],
        weight
      );
    }
  }

  
  for (let k = 0; k < nodeCount; k++) {
    for (let i = 0; i < nodeCount; i++) {
      for (let j = 0; j < nodeCount; j++) {
        
        dist[i][j] = Math.min(
          dist[i][j],
          dist[i][k] + dist[k][j]
        );
      }
    }
  }

  return dist[source]!;
}

runTextStdioIfMain(import.meta.url, floydWarshall);
