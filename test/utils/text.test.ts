import { describe, it, expect } from "bun:test";
import { stripCodeFences } from "../../src";

describe("stripCodeFences", () => {
  it("passes through plain commands unchanged", () => {
    expect(stripCodeFences("ls -la")).toBe("ls -la");
  });

  it("strips backtick fences with language tag", () => {
    expect(stripCodeFences("```bash\nls -la\n```")).toBe("ls -la");
  });

  it("strips backtick fences without language tag", () => {
    expect(stripCodeFences("```\necho hello\n```")).toBe("echo hello");
  });

  it("strips fences from multi-line commands", () => {
    const input = "```sh\nfind . -name '*.log' | xargs cat\n```";
    expect(stripCodeFences(input)).toBe("find . -name '*.log' | xargs cat");
  });

  it("trims whitespace", () => {
    expect(stripCodeFences("  echo hi  ")).toBe("echo hi");
  });
});
