
import { runProblemTestCases } from "../batch/run-problem-testcases.ts";
import { ValidationQueue } from "./queue.ts";

export interface WorkerOptions {
  queue?: ValidationQueue;
  pollIntervalMs?: number;
  shouldStop?: () => boolean;
}

/** run validation worker 기능을 수행합니다. */
export async function runValidationWorker(options: WorkerOptions = {}): Promise<void> {
  
  const queue = options.queue ?? new ValidationQueue();
  const pollIntervalMs = options.pollIntervalMs ?? 500;
  const shouldStop = options.shouldStop ?? (() => false);
  await queue.recoverInterrupted();

  while (!shouldStop()) {
    const job = await queue.claimNext();
    if (!job) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      continue;
    }

    try {
      
      job.results = await runProblemTestCases(job.problem);
      await queue.complete(job);
      console.log(`Validation job ${job.id} completed (${job.results.length} test cases)`);
    } catch (error) {
      const failedJob = await queue.fail(job, error);
      console.error(`Validation job ${failedJob.id} failed: ${failedJob.error}`);
    }
  }
}
