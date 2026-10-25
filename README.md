# Problems API

## Project map for beginners

- `src/core/algorithms`: shortest-path implementations and their stdin/stdout adapter.
- `src/core/generators`: reproducible random graphs for testing and benchmarking.
- `src/core/testing` and `src/batch`: run algorithms, compare outputs, and summarize results.
- `src/server`: HTTP API. It saves problems and queues validation jobs.
- `src/worker`: the separate process that takes queued jobs and runs the tests.
- `src/db/repositories`: reads and writes application data in SQLite.
- `src/types`: TypeScript descriptions of graphs, problems, jobs, and results.
- `tests`: automated tests run by Vitest.

The application stores problems, test cases, validation jobs, and results in normalized SQLite tables.

Start the API with `npm run dev:server`. Problem and validation job data are stored in `data/algocheck.sqlite` using SQLite. The first run imports existing problems and validation jobs from the legacy JSON files in `data/`.

## Register a problem

`POST /problems` requires the function names to use for the candidate and reference algorithms. The currently available pair is `dijkstra` and `floydWarshall`.

```json
{
  "title": "Shortest path",
  "description": "Compare shortest path implementations",
  "candidateAlgorithm": "dijkstra",
  "referenceAlgorithm": "floydWarshall"
}
```

The response includes the numeric problem `id` and an initially empty `testCases` array.

## Register a test case

`POST /problems/:id` adds a test case to that problem. Both `input` and `output` are required strings. The request body is JSON, while the algorithm input and expected output are plain text. For shortest path, `input` uses the stdin format: a header line (`nodeCount edgeCount source`) followed by one line per edge. `output` contains the expected stdout text.

```json
{
  "input": "3 2 0\n0 1 5\n1 2 2\n",
  "output": "0 5 7"
}
```

Each test case receives a numeric `id` within its problem. The other endpoints are `GET /problems`, `GET /problems/:id`, and `DELETE /problems/:id`.

## Start a problem validation job

The API server only queues the problem snapshot; it does not execute test cases. Run the worker as a separate process, using the same project directory and `DATABASE_PATH` value as the API server:

```bash
# 터미널 1
npm run dev:server

# 터미널 2
npm run worker
```

Queue all test cases for one problem with `POST /problems/:id/test`:

```bash
curl -X POST http://localhost:3000/problems/5/test
```

The API responds with HTTP `202` and a `jobId`. Poll the returned status URL to check progress and retrieve a compact summary with per-test-case results. The response omits the saved input data:

```bash
curl http://localhost:3000/jobs/<jobId>
```

Example result:

```json
{
  "jobId": "...",
  "problemId": 5,
  "problemTitle": "최단 경로 테스트",
  "status": "completed",
  "summary": {
    "total": 100,
    "candidatePassed": 100,
    "candidateFailed": 0,
    "referencePassed": 100,
    "referenceFailed": 0,
    "outputsMatching": 100
  },
  "results": [
    { "testCaseId": 1, "candidate": "PASS", "reference": "PASS", "matching": true }
  ]
}
```

Job status is `queued`, `running`, `completed`, or `failed`. A completed job includes candidate/reference pass results and output comparisons. A completed job may contain failed test cases; `failed` means the worker could not complete the job. Validation jobs and results are stored in the shared SQLite database. Set `DATABASE_PATH` on both processes when using a non-default database file.

## Run saved test cases

Run every test case in the SQL database against both selected algorithms and compare each result with the saved `output`:

```bash
npm run test:problems
```

The command prints a result for each problem and test case and exits with a non-zero status if either algorithm fails or does not match the expected output. Graphs are undirected by default; set a problem's `directed` field to `1` in the `problems` table to run its cases as directed graphs.


