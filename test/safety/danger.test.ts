import { describe, it, expect } from "bun:test";
import { isDangerous } from "../../src";

describe("isDangerous", () => {
  // ── Safe (read-only) commands ───────────────────────────────────────────
  it("safe: ls", () => expect(isDangerous("ls -la")).toBe(false));
  it("safe: cat", () => expect(isDangerous("cat foo.txt")).toBe(false));
  it("safe: grep", () => expect(isDangerous("grep -r 'hello' .")).toBe(false));
  it("safe: find", () => expect(isDangerous("find . -name '*.log'")).toBe(false));
  it("safe: head/tail", () => expect(isDangerous("head -20 file.txt")).toBe(false));
  it("safe: wc", () => expect(isDangerous("wc -l *.ts")).toBe(false));
  it("safe: echo to stdout", () => expect(isDangerous("echo hello world")).toBe(false));
  it("safe: pwd", () => expect(isDangerous("pwd")).toBe(false));
  it("safe: du", () => expect(isDangerous("du -sh *")).toBe(false));
  it("safe: tree", () => expect(isDangerous("tree -L 2")).toBe(false));
  it("safe: git status", () => expect(isDangerous("git status")).toBe(false));
  it("safe: git log", () => expect(isDangerous("git log --oneline -10")).toBe(false));
  it("safe: git diff", () => expect(isDangerous("git diff HEAD~1")).toBe(false));
  it("safe: ps", () => expect(isDangerous("ps aux")).toBe(false));
  it("confirmation: compound shell command", () => expect(isDangerous("find . -name '*.log' | xargs cat")).toBe(true));
  it("safe: curl GET", () => expect(isDangerous("curl https://example.com")).toBe(false));

  // ── Dangerous: file deletion ────────────────────────────────────────────
  it("dangerous: rm", () => expect(isDangerous("rm foo.txt")).toBe(true));
  it("dangerous: rm -rf", () => expect(isDangerous("rm -rf /tmp/stuff")).toBe(true));
  it("dangerous: rmdir", () => expect(isDangerous("rmdir empty_dir")).toBe(true));

  // ── Dangerous: file modification ────────────────────────────────────────
  it("dangerous: mv", () => expect(isDangerous("mv a.txt b.txt")).toBe(true));
  it("dangerous: cp", () => expect(isDangerous("cp file.txt backup/")).toBe(true));
  it("dangerous: chmod", () => expect(isDangerous("chmod 755 script.sh")).toBe(true));
  it("dangerous: chown", () => expect(isDangerous("chown root file")).toBe(true));
  it("dangerous: touch", () => expect(isDangerous("touch newfile.txt")).toBe(true));
  it("dangerous: mkdir", () => expect(isDangerous("mkdir new_dir")).toBe(true));

  // ── Dangerous: write redirection ────────────────────────────────────────
  it("dangerous: redirect >", () => expect(isDangerous("echo hi > file.txt")).toBe(true));
  it("dangerous: append >>", () => expect(isDangerous("echo hi >> file.txt")).toBe(true));
  it("dangerous: tee", () => expect(isDangerous("echo hi | tee file.txt")).toBe(true));

  // ── Dangerous: in-place editing ─────────────────────────────────────────
  it("dangerous: sed -i", () => expect(isDangerous("sed -i 's/foo/bar/g' file.txt")).toBe(true));

  // ── Dangerous: package management ───────────────────────────────────────
  it("dangerous: brew install", () => expect(isDangerous("brew install jq")).toBe(true));
  it("dangerous: npm install", () => expect(isDangerous("npm install lodash")).toBe(true));
  it("dangerous: bun add", () => expect(isDangerous("bun add zod")).toBe(true));

  // ── Dangerous: git destructive ──────────────────────────────────────────
  it("dangerous: git push", () => expect(isDangerous("git push origin main")).toBe(true));
  it("dangerous: git reset", () => expect(isDangerous("git reset --hard HEAD~1")).toBe(true));
  it("dangerous: git commit", () => expect(isDangerous("git commit -m 'msg'")).toBe(true));

  // ── Dangerous: process/system ───────────────────────────────────────────
  it("dangerous: sudo", () => expect(isDangerous("sudo rm -rf /")).toBe(true));
  it("dangerous: kill", () => expect(isDangerous("kill -9 1234")).toBe(true));
  it("dangerous: killall", () => expect(isDangerous("killall node")).toBe(true));

  // ── Dangerous: docker ───────────────────────────────────────────────────
  it("dangerous: docker rm", () => expect(isDangerous("docker rm container_id")).toBe(true));
  it("dangerous: docker system prune", () => expect(isDangerous("docker system prune -a")).toBe(true));

  // ── Dangerous: curl/wget with side effects ──────────────────────────────
  it("dangerous: curl POST", () => expect(isDangerous("curl -X POST https://api.example.com")).toBe(true));
  it("dangerous: curl -o", () => expect(isDangerous("curl -o file.zip https://example.com/file")).toBe(true));
  it("dangerous: wget", () => expect(isDangerous("wget https://example.com/file.tar.gz")).toBe(true));
});


describe("conservative execution policy", () => {
  it("requires confirmation for deletion, unknown programs, and git global flags", () => {
    for (const command of ["find . -type f -delete", "python3 cleanup.py", "git -C /tmp/example reset --hard",
      "curl --data payload https://example.com", "tree -ao listing.txt", "file -C", "sort --output=sorted.txt input.txt",
      "rg --pre=script pattern", "ls && rm file", "echo $(touch file)", "cat <(python3 script.py)"]) {
      expect(isDangerous(command)).toBe(true);
    }
  });
  it("allows simple read commands and literal quoted text", () => {
    expect(isDangerous("git -C /tmp/example status")).toBe(false);
    expect(isDangerous("echo 'rm -rf $(anything)'")).toBe(false);
    expect(isDangerous("cat 'file with spaces.txt'")).toBe(false);
  });
  it("treats malformed and empty commands as unknown", () => {
    for (const command of ["", "cat 'unterminated", "ls \\", "ls\u00a0rm"]) expect(isDangerous(command)).toBe(true);
  });
});
