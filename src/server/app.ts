

import { Buffer } from "node:buffer";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { ProblemRepository } from "../db/repositories/problem.repository.ts";
import type { NewProblem } from "../types/problem.ts";
import { ValidationQueue } from "../worker/queue.ts";

const MAX_BODY_BYTES = 1024 * 1024;

export interface AppOptions {
  databasePath?: string;
}

/** create app 기능을 수행합니다. */
export function createApp(options: AppOptions = {}): Server {
  
  const repository = new ProblemRepository(options.databasePath);
  const queue = new ValidationQueue(options.databasePath);

  return createServer((request, response) => {
    void handleRequest(request, response, repository, queue).catch((error: unknown) => {
      if (error instanceof RequestError) {
        sendJson(response, error.statusCode, { error: error.message });
        return;
      }
      console.error(error);
      sendJson(response, 500, { error: "Internal server error" });
    });
  });
}

/** handle request 기능을 수행합니다. */
async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  repository: ProblemRepository,
  queue: ValidationQueue,
): Promise<void> {
  
  const url = new URL(request.url ?? "/", "http://localhost");
  const pathname = url.pathname.replace(/\/$/, "") || "/";
  const jobPath = /^\/jobs\/([\da-f-]{36})$/.exec(pathname);
  if (request.method === "GET" && jobPath) {
    
    const job = await queue.get(jobPath[1]!);
    if (!job) {
      sendJson(response, 404, { error: "Job not found" });
      return;
    }
    const results = job.results ?? [];
    sendJson(response, 200, {
      jobId: job.id,
      problemId: job.problemId,
      problemTitle: job.problem.title,
      status: job.status,
      createdAt: job.createdAt,
      ...(job.startedAt ? { startedAt: job.startedAt } : {}),
      ...(job.finishedAt ? { finishedAt: job.finishedAt } : {}),
      summary: {
        total: job.problem.testCases.length,
        candidatePassed: results.filter((result) => result.candidate === "PASS").length,
        candidateFailed: results.filter((result) => result.candidate === "FAIL").length,
        referencePassed: results.filter((result) => result.reference === "PASS").length,
        referenceFailed: results.filter((result) => result.reference === "FAIL").length,
        outputsMatching: results.filter((result) => result.matching).length,
      },
      ...(job.error ? { error: job.error } : {}),
      results: results.map(({ testCaseId, candidate, reference, matching, details }) => ({
        testCaseId,
        candidate,
        reference,
        matching,
        ...(details ? { details } : {}),
      })),
    });
    return;
  }

  const runPath = /^\/problems\/(\d+)\/test$/.exec(pathname);
  if (request.method === "POST" && runPath) {
    
    const problemId = Number(runPath[1]);
    if (!Number.isSafeInteger(problemId) || problemId < 1) {
      sendJson(response, 400, { error: "Invalid problem id" });
      return;
    }
    const problem = await repository.getById(problemId);
    if (!problem) {
      sendJson(response, 404, { error: "Problem not found" });
      return;
    }
    const job = await queue.enqueue(problem);
    
    sendJson(response, 202, {
      jobId: job.id,
      problemId: job.problemId,
      status: job.status,
      statusUrl: `/jobs/${job.id}`,
    });
    return;
  }

  const problemPath = /^\/problems(?:\/([^/]+))?$/.exec(pathname);

  if (!problemPath) {
    sendJson(response, 404, { error: "Route not found" });
    return;
  }

  const encodedId = problemPath[1];
  let id: number | undefined;
  if (encodedId !== undefined) {
    const parsedId = Number(encodedId);
    if (!/^\d+$/.test(encodedId) || !Number.isSafeInteger(parsedId) || parsedId < 1) {
      sendJson(response, 400, { error: "Invalid problem id" });
      return;
    }
    id = parsedId;
  }

  if (request.method === "POST" && id === undefined) {
    const body = await readJsonBody(request);
    if (!isNewProblem(body)) {
      sendJson(response, 400, {
        error: "Body must include non-empty title and description, candidateAlgorithm 'dijkstra', and referenceAlgorithm 'floydWarshall'",
      });
      return;
    }
    sendJson(response, 201, await repository.create(body));
    return;
  }

  if (request.method === "POST" && id !== undefined) {
    const body = await readJsonBody(request);
    if (!isNewTestCase(body)) {
      sendJson(response, 400, { error: "Body must include input and output strings" });
      return;
    }
    const problem = await repository.addTestCase(id, body.input, body.output);
    if (!problem) {
      sendJson(response, 404, { error: "Problem not found" });
      return;
    }
    sendJson(response, 201, problem.testCases.at(-1));
    return;
  }

  if (request.method === "GET" && id === undefined) {
    sendJson(response, 200, await repository.list());
    return;
  }

  if (request.method === "GET" && id !== undefined) {
    const problem = await repository.getById(id);
    if (!problem) {
      sendJson(response, 404, { error: "Problem not found" });
      return;
    }
    sendJson(response, 200, problem);
    return;
  }

  if (request.method === "DELETE" && id !== undefined) {
    const deleted = await repository.delete(id);
    if (!deleted) {
      sendJson(response, 404, { error: "Problem not found" });
      return;
    }
    sendJson(response, 200, { id, deleted: true });
    return;
  }

  sendJson(response, 405, { error: "Method not allowed" }, { Allow: id === undefined ? "POST, GET" : "POST, GET, DELETE" });
}

/** read json body 기능을 수행합니다. */
async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new RequestError(413, "Request body is too large");
    }
    chunks.push(buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new RequestError(400, "Request body must be valid JSON");
  }
}

/** is new problem 기능을 수행합니다. */
function isNewProblem(value: unknown): value is NewProblem {
  
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.title === "string"
    && record.title.trim().length > 0
    && typeof record.description === "string"
    && record.description.trim().length > 0
    && record.candidateAlgorithm === "dijkstra"
    && record.referenceAlgorithm === "floydWarshall";
}

/** is new test case 기능을 수행합니다. */
function isNewTestCase(value: unknown): value is { input: string; output: string } {
  
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.input === "string" && typeof record.output === "string";
}

/** send json 기능을 수행합니다. */
function sendJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8", ...headers });
  response.end(JSON.stringify(body, null, 2));
}

class RequestError extends Error {
  /** constructor 메서드 기능을 수행합니다. */
  constructor(readonly statusCode: number, message: string) {
    super(message);
  }
}


