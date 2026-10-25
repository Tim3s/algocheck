


import type { Graph } from "../../../types/graph.ts";
import { runTextStdioIfMain } from "./stdio.ts";

/** dijkstra 기능을 수행합니다. */
export function dijkstra(
  graph: Graph,
  source: number
): number[] {
  
  const { nodeCount, edges, directed } = graph;

  if (!Number.isInteger(source) || source < 0 || source >= nodeCount) {
    throw new RangeError("source must be an integer within the graph's vertex range");
  }

  
  const adj: { to: number; weight: number }[][] =
    Array.from({ length: nodeCount }, () => []);

  for (const edge of edges) {
    adj[edge.from].push({
      to: edge.to,
      weight: edge.weight,
    });

    if (!directed) {
      adj[edge.to].push({
        to: edge.from,
        weight: edge.weight,
      });
    }
  }

  
  const dist = Array(nodeCount).fill(Infinity);
  const visited = Array(nodeCount).fill(false);

  dist[source] = 0;

  
  for (let count = 0; count < nodeCount; count++) {
    let u = -1;

    for (let i = 0; i < nodeCount; i++) {
      if (
        !visited[i] &&
        (u === -1 || dist[i] < dist[u])
      ) {
        u = i;
      }
    }

    
    if (u === -1 || dist[u] === Infinity) {
      break;
    }

    visited[u] = true;

    
    for (const edge of adj[u]) {
      if (edge.weight < 0) {
        throw new Error(
          "Dijkstra does not support negative edge weights"
        );
      }

      const newDist = dist[u] + edge.weight;

      
      if (newDist < dist[edge.to]) {
        dist[edge.to] = newDist;
      }
    }
  }

  return dist;
}

runTextStdioIfMain(import.meta.url, dijkstra);
