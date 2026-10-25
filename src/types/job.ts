
import type { Problem } from "./problem.ts";
import type { TestCaseResult } from "./validation.ts";


export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface ValidationJob {
  
  id: string;
  problemId: number;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  
  problem: Problem;
  
  results?: TestCaseResult[];
  error?: string;
}
