import { execSync } from "child_process";
import type { GregConfig } from "../../types";
import { C } from "../../utils/colors";
import { ask } from "../../utils/input";
import { stripCodeFences } from "../../utils/text";
import { getTerminalContext, LIMITS_AFM, LIMITS_CLOUD } from "../../llm/context";
import { buildSystemPrompt } from "../../llm/prompt";
import { callLLM } from "../../llm/dispatcher";
import { loadSkills } from "../../skills/loader";
import { matchSkillsWithAI } from "../../skills/matcher";
import { buildSkillsPromptSection } from "../../skills/prompt";
import { isDangerous } from "../../safety/danger";

export async function getCommand(
  config: GregConfig, prompt: string
): Promise<string> {
  const limits = config.provider === "afm" ? LIMITS_AFM : LIMITS_CLOUD;
  const ctx = getTerminalContext(limits);
  let systemPrompt = buildSystemPrompt(ctx);

  // Load and match skills (AI-powered for cloud providers, keyword for AFM)
  const allSkills = loadSkills();
  const matched = await matchSkillsWithAI(config, allSkills, prompt);
  const skillsSection = buildSkillsPromptSection(matched);
  if (skillsSection) {
    systemPrompt += "\n" + skillsSection;
  }

  console.error(C.dim("  Thinking..."));
  const raw = await callLLM(config, systemPrompt, prompt);
  return stripCodeFences(raw);
}

export async function runCommand(config: GregConfig, prompt: string): Promise<void> {
  let command: string;
  try {
    command = await getCommand(config, prompt);
  } catch (err: any) {
    console.error(C.red(`\nAPI error: ${err.message}`));
    if (
      err.message.includes("auth") ||
      err.message.includes("key") ||
      err.message.includes("401") ||
      err.message.includes("unavailable")
    ) {
      console.error(C.dim("Run `greg --setup` to reconfigure."));
    }
    process.exit(1);
  }

  if (!command) {
    console.error(C.red("No command generated."));
    process.exit(1);
  }

  // Display
  console.error("");
  console.error(C.dim("─────────────────────────────────────────"));
  console.error(`  ${C.greenBold(command)}`);
  console.error(C.dim("─────────────────────────────────────────"));
  console.error("");

  // Only ask for confirmation if the command is potentially destructive
  if (isDangerous(command)) {
    const choice = await ask(
      `${C.yellow("⚠ This may modify files or have side effects. Run?")} [${C.green("Y")}/${C.red("n")}] `
    );

    if (choice.toLowerCase() === "n") {
      console.error(C.dim("Aborted."));
      process.exit(0);
    }
  }

  // Execute
  try {
    execSync(command, { stdio: "inherit", shell: "/bin/zsh" });
  } catch (err: any) {
    process.exit(err.status ?? 1);
  }
}
