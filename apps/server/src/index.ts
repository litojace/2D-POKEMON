import "dotenv/config";
import { createArenaServer } from "./server.js";
const server = createArenaServer();
const port = Number(process.env.PORT ?? 3001);
server.http.listen(port, "0.0.0.0", () =>
  console.log(`Pokémon Arena listening on http://localhost:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    void server.close().then(() => process.exit(0));
  });
