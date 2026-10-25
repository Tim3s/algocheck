import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { getDatabase } from "../db/database.ts";
import type { ValidationJob } from "../types/job.ts";
import type { Problem } from "../types/problem.ts";
import type { TestCaseResult } from "../types/validation.ts";

export class ValidationQueue {
  private readonly database: DatabaseSync;

  /** Connects the validation queue to the shared SQL database. */
  constructor(databasePath?: string) {
    this.database = getDatabase(databasePath);
  }

  /** Saves a new job and its immutable problem snapshot in SQL. */
  async enqueue(problem: Problem): Promise<ValidationJob> {
    const job: ValidationJob = { id: randomUUID(), problemId: problem.id, status: "queued", createdAt: new Date().toISOString(), problem };
    this.database.exec("BEGIN");
    try {
      this.insertJob(job);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return job;
  }

  /** Reads a job and its related snapshot and results from SQL. */
  async get(id: string): Promise<ValidationJob | undefined> {
    const row = this.database.prepare("SELECT * FROM validation_jobs WHERE id = ?").get(id) as JobRow | undefined;
    return row ? this.readJob(row) : undefined;
  }

  /** Requeues work left in the running state after a worker stopped. */
  async recoverInterrupted(): Promise<void> {
    this.database.prepare("UPDATE validation_jobs SET status='queued', started_at=NULL WHERE status='running'").run();
  }

  /** Atomically claims the oldest queued job for one worker. */
  async claimNext(): Promise<ValidationJob | undefined> {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const row = this.database.prepare("SELECT * FROM validation_jobs WHERE status='queued' ORDER BY created_at,id LIMIT 1").get() as JobRow | undefined;
      if (!row) {
        this.database.exec("COMMIT");
        return undefined;
      }
      const startedAt = new Date().toISOString();
      this.database.prepare("UPDATE validation_jobs SET status='running', started_at=? WHERE id=? AND status='queued'").run(startedAt, row.id);
      this.database.exec("COMMIT");
      row.status = "running";
      row.started_at = startedAt;
      return this.readJob(row);
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  /** Marks a job complete and stores its results in SQL. */
  async complete(job: ValidationJob): Promise<ValidationJob> {
    job.status = "completed";
    job.finishedAt = new Date().toISOString();
    this.persistFinal(job);
    return job;
  }

  /** Marks a job failed and stores its error in SQL. */
  async fail(job: ValidationJob, error: unknown): Promise<ValidationJob> {
    job.status = "failed";
    job.error = error instanceof Error ? error.message : String(error);
    job.finishedAt = new Date().toISOString();
    this.persistFinal(job);
    return job;
  }

  /** Inserts a job row and its snapshot testcases. */
  private insertJob(job: ValidationJob): void {
    const p = job.problem;
    this.database.prepare("INSERT INTO validation_jobs (id,problem_id,status,created_at,started_at,finished_at,problem_title,problem_description,candidate_algorithm,reference_algorithm,directed,error) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(job.id, job.problemId, job.status, job.createdAt, job.startedAt ?? null, job.finishedAt ?? null, p.title, p.description, p.candidateAlgorithm, p.referenceAlgorithm, p.directed === true ? 1 : 0, job.error ?? null);
    const insertCase = this.database.prepare("INSERT INTO validation_job_test_cases (job_id,id,input,output,created_at) VALUES (?,?,?,?,?)");
    for (const testCase of p.testCases) insertCase.run(job.id, testCase.id, testCase.input, testCase.output, testCase.createdAt);
  }

  /** Writes final state and any per-testcase results atomically. */
  private persistFinal(job: ValidationJob): void {
    this.database.exec("BEGIN");
    try {
      this.database.prepare("UPDATE validation_jobs SET status=?,finished_at=?,error=? WHERE id=?")
        .run(job.status, job.finishedAt ?? null, job.error ?? null, job.id);
      this.database.prepare("DELETE FROM validation_job_results WHERE job_id=?").run(job.id);
      const insertResult = this.database.prepare("INSERT INTO validation_job_results (job_id,test_case_id,candidate,reference,matching,details) VALUES (?,?,?,?,?,?)");
      for (const result of job.results ?? []) insertResult.run(job.id, result.testCaseId, result.candidate, result.reference, result.matching ? 1 : 0, result.details ?? null);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  /** Rebuilds the public job object from normalized SQL rows. */
  private readJob(row: JobRow): ValidationJob {
    const cases = this.database.prepare("SELECT id,input,output,created_at AS createdAt FROM validation_job_test_cases WHERE job_id=? ORDER BY id").all(row.id) as Problem["testCases"];
    const resultRows = this.database.prepare("SELECT test_case_id AS testCaseId,candidate,reference,matching,details FROM validation_job_results WHERE job_id=? ORDER BY test_case_id").all(row.id) as Array<{testCaseId:number;candidate:"PASS"|"FAIL";reference:"PASS"|"FAIL";matching:number;details:string|null}>;
    const problem: Problem = { id: row.problem_id, title: row.problem_title, description: row.problem_description, createdAt: row.created_at, candidateAlgorithm: row.candidate_algorithm, referenceAlgorithm: row.reference_algorithm, directed: row.directed === 1, testCases: cases };
    const results: TestCaseResult[] = resultRows.map((result) => ({ testCaseId: result.testCaseId, candidate: result.candidate, reference: result.reference, matching: result.matching === 1, ...(result.details ? { details: result.details } : {}) }));
    return { id: row.id, problemId: row.problem_id, status: row.status as ValidationJob["status"], createdAt: row.created_at, ...(row.started_at ? { startedAt: row.started_at } : {}), ...(row.finished_at ? { finishedAt: row.finished_at } : {}), problem, ...(results.length ? { results } : {}), ...(row.error ? { error: row.error } : {}) };
  }
}

interface JobRow {
  id: string; problem_id: number; status: string; created_at: string; started_at: string | null; finished_at: string | null;
  problem_title: string; problem_description: string; candidate_algorithm: string; reference_algorithm: string; directed: number; error: string | null;
}

