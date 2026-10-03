import { route } from "../src/cli/router";

route(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Greg failed.");
  process.exitCode = 1;
});
