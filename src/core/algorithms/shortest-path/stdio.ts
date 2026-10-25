

import { createInterface } from "node:readline";
import process, { argv, stderr, stdin, stdout } from "node:process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Edge, Graph } from "../../../types/graph.ts";

type ShortestPathAlgorithm = (graph: Graph, source: number) => number[];



/** run text stdio if main 기능을 수행합니다. */
export function runTextStdioIfMain(
  moduleUrl: string,
  algorithm: ShortestPathAlgorithm,
): void {
  const entrypoint = argv[1];
  if (!entrypoint || resolve(entrypoint) !== resolve(fileURLToPath(moduleUrl))) return;

  void runFromStdin(algorithm, argv.includes("--directed")).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}

/** run from stdin 기능을 수행합니다. */
async function runFromStdin(algorithm: ShortestPathAlgorithm, directed: boolean): Promise<void> {
  
  const lines = createInterface({ input: stdin, crlfDelay: Infinity });
  let header: number[] | undefined;
  const edges: Edge[] = [];
  let expectedEdgeCount = 0;

  try {
    
    for await (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.length === 0) continue;
      const values = line.split(/\s+/);

      if (header === undefined) {
        
        if (values.length !== 3) throw new Error("First line must be: nodeCount edgeCount source");
        header = values.map((value: string, index: number) => parseInteger(value, ["node count", "edge count", "source"][index]!));
        const [nodeCount, edgeCount, source] = header as [number, number, number];
        if (nodeCount < 1 || edgeCount < 0) {
          throw new Error("node count must be positive and edge count must be non-negative");
        }
        if (source < 0 || source >= nodeCount) {
          throw new Error("source must be within the graph's vertex range");
        }
        expectedEdgeCount = edgeCount;
        continue;
      }

      if (values.length !== 3) throw new Error("Each edge line must be: from to weight");
      
      const from = parseInteger(values[0], "edge start vertex");
      const to = parseInteger(values[1], "edge end vertex");
      const weight = parseNumber(values[2], "edge weight");
      const nodeCount = header[0]!;
      if (from < 0 || from >= nodeCount || to < 0 || to >= nodeCount) {
        throw new Error("edge endpoint is outside the graph");
      }
      edges.push({ from, to, weight });
    }
  } finally {
    lines.close();
  }

  if (header === undefined) throw new Error("stdin ended before the graph header was received");
  if (edges.length !== expectedEdgeCount) {
    
    throw new Error(`Expected ${expectedEdgeCount} edge lines but received ${edges.length}`);
  }

  const [nodeCount, , source] = header as [number, number, number];
  
  const graph: Graph = { nodeCount, directed, edges };
  const distances = algorithm(graph, source);
  stdout.write(`${distances.map((distance) => Number.isFinite(distance) ? String(distance) : "INF").join(" ")}\n`);
}

/** parse integer 기능을 수행합니다. */
function parseInteger(value: string | undefined, label: string): number {
  if (value === undefined) throw new Error(`missing ${label}`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${label} must be an integer`);
  return parsed;
}

/** parse number 기능을 수행합니다. */
function parseNumber(value: string | undefined, label: string): number {
  if (value === undefined) throw new Error(`missing ${label}`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a finite number`);
  return parsed;
}
