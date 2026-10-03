import { spawn } from "child_process";
import { StringDecoder } from "string_decoder";
import { OutputExcerpt, type CommandResult } from "../session/memory";

export function executeCommand(command: string): Promise<Extract<CommandResult, { kind: "executed" | "failed" }>> {
  return new Promise(resolve => {
    const stdout = new OutputExcerpt();
    const stderr = new OutputExcerpt();
    const stdoutDecoder = new StringDecoder("utf8");
    const stderrDecoder = new StringDecoder("utf8");
    const child = spawn(command, { shell: "/bin/zsh", stdio: ["inherit", "pipe", "pipe"] });
    child.stdout.on("data", (bytes: Buffer) => stdout.append(stdoutDecoder.write(bytes)));
    child.stderr.on("data", (bytes: Buffer) => stderr.append(stderrDecoder.write(bytes)));
    child.stdout.pipe(process.stdout, { end: false });
    child.stderr.pipe(process.stderr, { end: false });
    const onInterrupt = () => child.kill("SIGINT");
    const onTerminate = () => child.kill("SIGTERM");
    process.on("SIGINT", onInterrupt); process.on("SIGTERM", onTerminate);
    let failure: string | undefined;
    child.on("error", error => { failure = error.message; });
    child.on("close", (exitCode, signal) => {
      stdout.append(stdoutDecoder.end()); stderr.append(stderrDecoder.end());
      process.removeListener("SIGINT", onInterrupt); process.removeListener("SIGTERM", onTerminate);
      resolve(failure ? { kind: "failed", message: failure } : {
        kind: "executed", exitCode, signal, stdout: stdout.value, stderr: stderr.value,
        truncated: stdout.truncated || stderr.truncated,
      });
    });
  });
}
