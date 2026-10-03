import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// No test may use personal Greg configuration, keys, or a compiled bridge.
const testConfigDir = mkdtempSync(join(tmpdir(), "greg-tests-"));
process.env.GREG_CONFIG_DIR = testConfigDir;
process.env.CLANG_MODULE_CACHE_PATH = join(testConfigDir, "clang-cache");
process.env.SWIFT_MODULECACHE_PATH = join(testConfigDir, "swift-cache");
process.on("exit", () => rmSync(testConfigDir, { recursive: true, force: true }));

const originalFetch = globalThis.fetch;
globalThis.fetch = Object.assign((input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : input);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("Tests cannot call external APIs.");
  }
  return originalFetch(input, init);
}, { preconnect: originalFetch.preconnect });
