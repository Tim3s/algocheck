
import process, { env } from "node:process";
import { runValidationWorker } from "./validation.worker.ts";
import { ValidationQueue } from "./queue.ts";

let stopping = false;

process.once("SIGINT", () => { stopping = true; });
process.once("SIGTERM", () => { stopping = true; });

void runValidationWorker({ queue: new ValidationQueue(env.DATABASE_PATH), shouldStop: () => stopping }).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

