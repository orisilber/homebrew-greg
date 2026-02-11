import type { GregConfig } from "./types";
import { stripCodeFences } from "./utils/text";
import { C } from "./utils/colors";
import { getTerminalContext, LIMITS_AFM, LIMITS_CLOUD } from "./llm/context";
import { buildSystemPrompt } from "./llm/prompt";
import { callLLM } from "./llm/dispatcher";
import { loadSkills, matchSkillsWithAI, buildSkillsPromptSection } from "./skills";

// Re-export for barrel
export { getTerminalContext, buildSystemPrompt };

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
