import type { DatabaseSync } from "node:sqlite";
import { getDatabase } from "../database.ts";
import type { NewProblem, Problem, ProblemTestCase } from "../../types/problem.ts";

export class ProblemRepository {
  private readonly database: DatabaseSync;

  /** Creates a repository connected to the shared SQL database. */
  constructor(databasePath?: string) {
    this.database = getDatabase(databasePath);
  }

  /** Returns all problems with their test cases in ID order. */
  async list(): Promise<Problem[]> {
    const rows = this.database.prepare("SELECT * FROM problems ORDER BY id").all() as ProblemRow[];
    return rows.map((row) => this.readProblem(row));
  }

  /** Returns one problem by its numeric ID. */
  async getById(id: number): Promise<Problem | undefined> {
    const row = this.database.prepare("SELECT * FROM problems WHERE id = ?").get(id) as ProblemRow | undefined;
    return row ? this.readProblem(row) : undefined;
  }

  /** Creates a problem and returns its assigned ID and timestamp. */
  async create(input: NewProblem): Promise<Problem> {
    const createdAt = new Date().toISOString();
    const result = this.database.prepare("INSERT INTO problems (title,description,created_at,candidate_algorithm,reference_algorithm,directed) VALUES (?,?,?,?,?,?)")
      .run(input.title, input.description, createdAt, input.candidateAlgorithm, input.referenceAlgorithm, input.directed === true ? 1 : 0);
    return (await this.getById(Number(result.lastInsertRowid)))!;
  }

  /** Adds a testcase to a problem and returns the updated problem. */
  async addTestCase(id: number, input: string, output: string): Promise<Problem | undefined> {
    if (!this.database.prepare("SELECT 1 FROM problems WHERE id = ?").get(id)) return undefined;
    const next = Number(this.database.prepare("SELECT COALESCE(MAX(id),0)+1 AS id FROM problem_test_cases WHERE problem_id = ?").get(id)?.id);
    this.database.prepare("INSERT INTO problem_test_cases (problem_id,id,input,output,created_at) VALUES (?,?,?,?,?)").run(id, next, input, output, new Date().toISOString());
    return this.getById(id);
  }

  /** Deletes a problem and its test cases, returning whether it existed. */
  async delete(id: number): Promise<boolean> {
    return this.database.prepare("DELETE FROM problems WHERE id = ?").run(id).changes > 0;
  }

  /** Reads a problem's child testcase rows and forms the API model. */
  private readProblem(row: ProblemRow): Problem {
    const testCases = this.database.prepare("SELECT id,input,output,created_at AS createdAt FROM problem_test_cases WHERE problem_id = ? ORDER BY id")
      .all(row.id) as ProblemTestCase[];
    return { id: row.id, title: row.title, description: row.description, createdAt: row.created_at, candidateAlgorithm: row.candidate_algorithm, referenceAlgorithm: row.reference_algorithm, directed: row.directed === 1, testCases };
  }
}

interface ProblemRow {
  id: number;
  title: string;
  description: string;
  created_at: string;
  candidate_algorithm: string;
  reference_algorithm: string;
  directed: number;
}

