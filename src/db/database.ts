import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { cwd } from "node:process";

const databases = new Map<string, DatabaseSync>();

/** Opens the shared SQLite database and creates the application tables. */
export function getDatabase(databasePath = resolve(cwd(), "data", "algocheck.sqlite")): DatabaseSync {
  const path = resolve(databasePath);
  const cached = databases.get(path);
  if (cached) return cached;
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
  db.exec("CREATE TABLE IF NOT EXISTS problems (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT NOT NULL, created_at TEXT NOT NULL, candidate_algorithm TEXT NOT NULL, reference_algorithm TEXT NOT NULL, directed INTEGER NOT NULL DEFAULT 0)");
  db.exec("CREATE TABLE IF NOT EXISTS problem_test_cases (problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE, id INTEGER NOT NULL, input TEXT NOT NULL, output TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(problem_id,id))");
  db.exec("CREATE TABLE IF NOT EXISTS validation_jobs (id TEXT PRIMARY KEY, problem_id INTEGER NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, started_at TEXT, finished_at TEXT, problem_title TEXT NOT NULL, problem_description TEXT NOT NULL, candidate_algorithm TEXT NOT NULL, reference_algorithm TEXT NOT NULL, directed INTEGER NOT NULL DEFAULT 0, error TEXT)");
  db.exec("CREATE TABLE IF NOT EXISTS validation_job_test_cases (job_id TEXT NOT NULL REFERENCES validation_jobs(id) ON DELETE CASCADE, id INTEGER NOT NULL, input TEXT NOT NULL, output TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(job_id,id))");
  db.exec("CREATE TABLE IF NOT EXISTS validation_job_results (job_id TEXT NOT NULL REFERENCES validation_jobs(id) ON DELETE CASCADE, test_case_id INTEGER NOT NULL, candidate TEXT NOT NULL, reference TEXT NOT NULL, matching INTEGER NOT NULL, details TEXT, PRIMARY KEY(job_id,test_case_id))");
  databases.set(path, db);
  migrateLegacyData(db);
  return db;
}

/** Imports existing JSON problem and validation-job records once. */
function migrateLegacyData(db: DatabaseSync): void {
  const problemPath = resolve(cwd(), "data", "problems.json");
  if (existsSync(problemPath) && Number(db.prepare("SELECT COUNT(*) AS count FROM problems").get()?.count ?? 0) === 0) {
    const parsed: unknown = JSON.parse(readFileSync(problemPath, "utf8"));
    const problems = Array.isArray(parsed) ? parsed : typeof parsed === "object" && parsed !== null && "problems" in parsed && Array.isArray(parsed.problems) ? parsed.problems : [];
    db.exec("BEGIN");
    try {
      for (let i = 0; i < problems.length; i++) {
        const p = problems[i] as Record<string, unknown>;
        const id = Number(p.id ?? i + 1);
        db.prepare("INSERT INTO problems (id,title,description,created_at,candidate_algorithm,reference_algorithm,directed) VALUES (?,?,?,?,?,?,?)")
          .run(id, String(p.title ?? ""), String(p.description ?? ""), String(p.createdAt ?? new Date().toISOString()), String(p.candidateAlgorithm ?? "dijkstra"), String(p.referenceAlgorithm ?? "floydWarshall"), p.directed === true ? 1 : 0);
        const cases = Array.isArray(p.testCases) ? p.testCases as Array<Record<string, unknown>> : [];
        for (let j = 0; j < cases.length; j++) {
          const c = cases[j];
          db.prepare("INSERT OR IGNORE INTO problem_test_cases (problem_id,id,input,output,created_at) VALUES (?,?,?,?,?)").run(id, Number(c.id ?? j + 1), String(c.input ?? ""), String(c.output ?? ""), String(c.createdAt ?? new Date().toISOString()));
        }
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  const jobsPath = resolve(cwd(), "data", "validation-jobs");
  if (!existsSync(jobsPath)) return;
  for (const name of readdirSync(jobsPath).filter((entry) => entry.endsWith(".json"))) {
    const job = JSON.parse(readFileSync(resolve(jobsPath, name), "utf8")) as LegacyJob;
    if (!job.id || !job.problem || db.prepare("SELECT 1 FROM validation_jobs WHERE id=?").get(job.id)) continue;
    const p = job.problem;
    db.exec("BEGIN");
    try {
      db.prepare("INSERT INTO validation_jobs (id,problem_id,status,created_at,started_at,finished_at,problem_title,problem_description,candidate_algorithm,reference_algorithm,directed,error) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
        .run(job.id, job.problemId ?? p.id, job.status === "running" ? "queued" : job.status ?? "queued", job.createdAt ?? new Date().toISOString(), job.status === "running" ? null : job.startedAt ?? null, job.finishedAt ?? null, p.title, p.description, p.candidateAlgorithm, p.referenceAlgorithm, p.directed === true ? 1 : 0, job.error ?? null);
      const addCase = db.prepare("INSERT INTO validation_job_test_cases (job_id,id,input,output,created_at) VALUES (?,?,?,?,?)");
      for (const c of p.testCases ?? []) addCase.run(job.id, c.id, c.input, c.output, c.createdAt);
      const addResult = db.prepare("INSERT INTO validation_job_results (job_id,test_case_id,candidate,reference,matching,details) VALUES (?,?,?,?,?,?)");
      for (const result of job.results ?? []) addResult.run(job.id, result.testCaseId, result.candidate, result.reference, result.matching ? 1 : 0, result.details ?? null);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}

interface LegacyJob {
  id: string; problemId?: number; status?: string; createdAt?: string; startedAt?: string; finishedAt?: string; error?: string;
  problem?: { id: number; title: string; description: string; candidateAlgorithm: string; referenceAlgorithm: string; directed?: boolean; testCases: Array<{id:number;input:string;output:string;createdAt:string}> };
  results?: Array<{testCaseId:number;candidate:string;reference:string;matching:boolean;details?:string}>;
}



