
import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { generateRandomGraph } from '../src/core/generators/graph.generator.ts';
import {
  DIJKSTRA_MODULE,
  FLOYD_WARSHALL_MODULE,
  runAlgorithmProcessAsync,
} from '../src/core/testing/algorithm-process.ts';
import type { Graph } from '../src/types/graph.ts';

describe('shortest-path stdin/stdout programs', () => {
  
  const graph: Graph = {
    nodeCount: 4,
    directed: false,
    edges: [
      { from: 0, to: 1, weight: 4 },
      { from: 0, to: 2, weight: 10 },
      { from: 1, to: 2, weight: 1 },
      { from: 2, to: 3, weight: 2 },
    ],
  };

  it('reads a text graph from stdin and prints Dijkstra distances on stdout', async () => {
    await expect(runAlgorithmProcessAsync(DIJKSTRA_MODULE, { graph, source: 0 })).resolves.toEqual([0, 4, 5, 7]);
  });

  it('reads a text graph from stdin and prints Floyd-Warshall distances on stdout', async () => {
    await expect(runAlgorithmProcessAsync(FLOYD_WARSHALL_MODULE, { graph, source: 0 })).resolves.toEqual([0, 4, 5, 7]);
  });

  it('prints INF for unreachable vertices', async () => {
    const disconnectedGraph: Graph = { nodeCount: 3, directed: true, edges: [] };
    await expect(runAlgorithmProcessAsync(DIJKSTRA_MODULE, { graph: disconnectedGraph, source: 0 })).resolves.toEqual([
      0,
      Infinity,
      Infinity,
    ]);
    await expect(runAlgorithmProcessAsync(FLOYD_WARSHALL_MODULE, { graph: disconnectedGraph, source: 0 })).resolves.toEqual([
      0,
      Infinity,
      Infinity,
    ]);
  });

  it('waits for stdin EOF before printing the result', async () => {
    
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', fileURLToPath(DIJKSTRA_MODULE)],
      { cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let capturedOutput = '';
    const outputPromise = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Algorithm did not finish after stdin EOF')), 5000);
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        capturedOutput += chunk;
        if (capturedOutput.includes('\n')) {
          clearTimeout(timeout);
          resolve(capturedOutput.trim());
        }
      });
      child.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    child.stdin.write('4 1 0\n0 1 4\n');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(capturedOutput).toBe('');
    expect(child.exitCode).toBeNull();
    child.stdin.end();
    try {
      expect(await outputPromise).toBe('0 4 INF INF');
    } finally {
      child.kill();
    }
  });

  it('matches stdout for both programs on 100 seeded random graphs per direction', async () => {
    
    const cases: Array<{ graph: Graph; source: number; context: string }> = [];
    for (const directed of [false, true]) {
      for (let seed = 0; seed < 100; seed++) {
        const nodeCount = 2 + (seed * 7) % 19;
        const maxEdgeCount = directed
          ? nodeCount * (nodeCount - 1)
          : (nodeCount * (nodeCount - 1)) / 2;
        const edgeCount = Math.floor(((seed * 37) % 101) / 100 * maxEdgeCount);
        const randomGraph = generateRandomGraph({
          nodeCount,
          edgeCount,
          directed,
          minWeight: 0,
          maxWeight: 20,
          seed,
        });

        const source = (seed * 13) % nodeCount;
        const context = `directed=${directed}, seed=${seed}, nodeCount=${nodeCount}, edgeCount=${edgeCount}, source=${source}`;
        cases.push({ graph: randomGraph, source, context });
      }
    }

    let nextCase = 0;
    const workers = Array.from({ length: 8 }, async () => {
      while (nextCase < cases.length) {
        const current = cases[nextCase++]!;
        const input = { graph: current.graph, source: current.source };
        const [dijkstra, floydWarshall] = await Promise.all([
          runAlgorithmProcessAsync(DIJKSTRA_MODULE, input),
          runAlgorithmProcessAsync(FLOYD_WARSHALL_MODULE, input),
        ]);
        expect(dijkstra, current.context).toEqual(floydWarshall);
      }
    });
    await Promise.all(workers);
  }, 120_000);
});
