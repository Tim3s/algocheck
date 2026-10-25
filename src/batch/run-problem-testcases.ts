

import process from "node:process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ProblemRepository } from "../db/repositories/problem.repository.ts";
import type { Problem, ProblemTestCase } from "../types/problem.ts";
import type { TestCaseResult } from "../types/validation.ts";
import {
  DIJKSTRA_MODULE,
  FLOYD_WARSHALL_MODULE,
  runTextAlgorithmProcessAsync,
} from "../core/testing/algorithm-process.ts";

const algorithmModules: Record<string, URL> = {
  dijkstra: DIJKSTRA_MODULE,
  floydWarshall: FLOYD_WARSHALL_MODULE,
};

export type CaseResult = TestCaseResult;

/** run all problem test cases 기능을 수행합니다. */
export async function runAllProblemTestCases(): Promise<Array<CaseResult & { problemId: number }>> {
  
  const problems = await new ProblemRepository().list();
  const results: Array<CaseResult & { problemId: number }> = [];

  for (const problem of problems) {
    const problemResults = await runProblemTestCases(problem);
    for (const result of problemResults) {
      console.log(formatCaseResult(problem.id, result));
      results.push({ ...result, problemId: problem.id });
    }
  }

  const passed = results.filter((result) => result.candidate === "PASS" && result.reference === "PASS").length;
  console.log(`\nTest cases passed by both algorithms: ${passed}/${results.length}`);
  process.exitCode = passed === results.length ? 0 : 1;
  return results;
}

/** run problem test cases 기능을 수행합니다. */
export async function runProblemTestCases(problem: Problem): Promise<CaseResult[]> {
  
  const results: CaseResult[] = [];
  for (const testCase of problem.testCases ?? []) {
    results.push(await runTestCase(problem, testCase));
  }
  return results;
}

/** run test case 기능을 수행합니다. */
async function runTestCase(problem: Problem, testCase: ProblemTestCase): Promise<CaseResult> {
  
  const candidateModule = algorithmModules[problem.candidateAlgorithm];
  const referenceModule = algorithmModules[problem.referenceAlgorithm];
  if (!candidateModule || !referenceModule) {
    const detail = `Unknown algorithm name (candidate=${problem.candidateAlgorithm}, reference=${problem.referenceAlgorithm})`;
    return {
      testCaseId: testCase.id,
      candidate: "FAIL",
      reference: "FAIL",
      matching: false,
      details: detail,
    };
  }

  const directed = problem.directed === true;
  
  const [candidateRun, referenceRun] = await Promise.all([
    safelyRun(candidateModule, testCase.input, directed),
    safelyRun(referenceModule, testCase.input, directed),
  ]);
  
  const expected = normalize(testCase.output);
  const candidatePassed = candidateRun.output !== undefined && normalize(candidateRun.output) === expected;
  const referencePassed = referenceRun.output !== undefined && normalize(referenceRun.output) === expected;
  const matching = candidateRun.output !== undefined
    && referenceRun.output !== undefined
    && normalize(candidateRun.output) === normalize(referenceRun.output);
  const details = [
    candidateRun.error && `candidate: ${candidateRun.error}`,
    referenceRun.error && `reference: ${referenceRun.error}`,
    !candidatePassed && candidateRun.output !== undefined && `candidate output: ${JSON.stringify(candidateRun.output.trim())}`,
    !referencePassed && referenceRun.output !== undefined && `reference output: ${JSON.stringify(referenceRun.output.trim())}`,
  ].filter(Boolean).join("; ");

  return {
    testCaseId: testCase.id,
    candidate: candidatePassed ? "PASS" : "FAIL",
    reference: referencePassed ? "PASS" : "FAIL",
    matching,
    ...(details ? { details } : {}),
  };
}

/** format case result 기능을 수행합니다. */
export function formatCaseResult(problemId: number, result: CaseResult): string {
  return `Problem ${problemId}, case ${result.testCaseId}: candidate ${result.candidate}, `
    + `reference ${result.reference}, outputs ${result.matching ? "match" : "differ"}`
    + (result.details ? ` — ${result.details}` : "");
}

/** safely run 기능을 수행합니다. */
async function safelyRun(moduleUrl: URL, input: string, directed: boolean): Promise<{ output?: string; error?: string }> {
  
  try {
    return { output: await runTextAlgorithmProcessAsync(moduleUrl, input, directed) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/** normalize 기능을 수행합니다. */
function normalize(text: string): string {
  
  return text.trim().split(/\s+/).join(" ");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void runAllProblemTestCases().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
