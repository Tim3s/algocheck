
import { env } from "node:process";
import { createApp } from "./app.ts";

const port = Number(env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new RangeError("PORT must be an integer between 0 and 65535");
}

const server = createApp({
  databasePath: env.DATABASE_PATH,
});
server.listen(port, () => {
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  console.log(`Problems API listening at http://localhost:${actualPort}`);
});


