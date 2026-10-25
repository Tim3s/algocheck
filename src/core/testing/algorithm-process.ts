

import { spawn, spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import type { Graph } from "../../types/graph.ts";

export const DIJKSTRA_MODULE = new URL("../algorithms/shortest-path/candidate.ts", import.meta.url);
export const FLOYD_WARSHALL_MODULE = new URL("../algorithms/shortest-path/reference.ts", import.meta.url);

export interface ShortestPathInput {
  graph: Graph;
  source: number;
}


/** run algorithm process 기능을 수행합니다. */
export function runAlgorithmProcess(moduleUrl: URL, input: ShortestPathInput): number[] {
  
  const child = spawnSync(
    process.execPath,
    ["--import", "tsx", fileURLToPath(moduleUrl), ...(input.graph.directed ? ["--directed"] : [])],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      input: serializeInput(input),
      timeout: 60_000,
      maxBuffer: 1024 * 1024,
    },
  );

  if (child.error) throw child.error;
  if (child.status !== 0) {
    throw new Error(`Algorithm process exited with status ${child.status}: ${child.stderr.trim()}`);
  }

  return parseDistances(child.stdout, input.graph.nodeCount);
}


/** run algorithm process async 기능을 수행합니다. */
export function runAlgorithmProcessAsync(moduleUrl: URL, input: ShortestPathInput): Promise<number[]> {
  
  return runTextAlgorithmProcessAsync(moduleUrl, serializeInput(input), input.graph.directed)
    .then((output) => parseDistances(output, input.graph.nodeCount));
}


/** run text algorithm process async 기능을 수행합니다. */
export function runTextAlgorithmProcessAsync(
  moduleUrl: URL,
  input: string,
  directed = false,
): Promise<string> {
  
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", fileURLToPath(moduleUrl), ...(directed ? ["--directed"] : [])],
      { cwd: process.cwd(), stdio: ["pipe", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Algorithm process timed out after 60 seconds"));
    }, 60_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
    child.once("error", (error: Error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (status: number) => {
      clearTimeout(timeout);
      if (status !== 0) {
        reject(new Error(`Algorithm process exited with status ${status}: ${stderr.trim()}`));
        return;
      }
      resolve(stdout);
    });
    child.stdin.end(input);
  });
}

/** parse distances 기능을 수행합니다. */
function parseDistances(output: string, nodeCount: number): number[] {
  
  const tokens = output.trim().split(/\s+/);
  if (tokens.length !== nodeCount) {
    throw new Error(`Expected ${nodeCount} distances on stdout, received ${tokens.length}`);
  }
  return tokens.map((token) => {
    if (token === "INF") return Infinity;
    const distance = Number(token);
    if (!Number.isFinite(distance)) throw new Error(`Invalid distance on stdout: ${token}`);
    return distance;
  });
}

/** serialize input 기능을 수행합니다. */
function serializeInput({ graph, source }: ShortestPathInput): string {
  
  return [
    `${graph.nodeCount} ${graph.edges.length} ${source}`,
    ...graph.edges.map(({ from, to, weight }) => `${from} ${to} ${weight}`),
    "",
  ].join("\n");
}
