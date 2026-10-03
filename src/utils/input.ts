import { createInterface } from "readline";

export function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise(resolve => {
    // EOF also declines confirmation instead of leaving the process hanging.
    rl.once("close", () => resolve(""));
    rl.question(question, answer => { resolve(answer.trim()); rl.close(); });
  });
}

export function confirmsExecution(answer: string): boolean {
  return /^(y|yes)$/i.test(answer.trim());
}
