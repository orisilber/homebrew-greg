import { C } from "../utils/colors";
import { loadConfig } from "../config/config";
import { setup } from "./commands/setup";
import { skillsCommand } from "./commands/skills";
import { editorMode } from "./commands/editor";
import { runCommand } from "./commands/run";

export async function route(args: string[]): Promise<void> {
  // --setup: reconfigure
  if (args[0] === "--setup") {
    await setup();
    return;
  }

  // --skills: manage skills
  if (args[0] === "--skills") {
    await skillsCommand(args.slice(1));
    return;
  }

  // Load or create config
  let config = loadConfig();
  if (!config) {
    config = await setup();
  }

  // No args: open editor to write a prompt
  let prompt: string;
  if (args.length === 0) {
    const editorPrompt = editorMode();
    if (!editorPrompt) {
      console.error(C.dim("Empty prompt, nothing to do."));
      process.exit(0);
    }
    prompt = editorPrompt;
  } else {
    prompt = args.join(" ");
  }

  await runCommand(config, prompt);
}
