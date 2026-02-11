import type { GregConfig } from "../types";
import { stripCodeFences } from "../utils/text";
import { C } from "../utils/colors";
import { callLLM } from "../llm/dispatcher";
import type { Skill } from "./loader";

/** Tokenize text into lowercase words, stripping punctuation */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2) // skip tiny words like "a", "to", "in"
  );
}

/**
 * Select skills whose description matches the user prompt.
 * Skills with no description are always included.
 * Skills with a description are included if there's keyword overlap.
 */
export function matchSkills(skills: Skill[], userPrompt: string): Skill[] {
  if (skills.length === 0) return [];

  const promptTokens = tokenize(userPrompt);

  return skills.filter((skill) => {
    // No description = always active (like a global skill)
    if (!skill.description) return true;

    const descTokens = tokenize(skill.description);
    let matches = 0;
    for (const token of descTokens) {
      if (promptTokens.has(token)) matches++;
    }

    // At least one meaningful keyword overlap
    return matches > 0;
  });
}

function logSkills(skills: Skill[]): void {
  for (const s of skills) {
    if (s.description) {
      console.error(C.green(`  Using skill: ${s.name}`));
    }
  }
}

export async function matchSkillsWithAI(
  config: GregConfig, skills: Skill[], userPrompt: string
): Promise<Skill[]> {
  const globalSkills = skills.filter((s) => !s.description);
  const conditionalSkills = skills.filter((s) => s.description);

  if (conditionalSkills.length === 0) {
    logSkills(globalSkills);
    return globalSkills;
  }

  // AFM: use fast keyword matching (no extra API call)
  if (config.provider === "afm") {
    const matched = matchSkills(skills, userPrompt);
    logSkills(matched);
    return matched;
  }

  console.error(C.dim("  Matching skills..."));

  const skillList = conditionalSkills
    .map((s) => `- "${s.name}": ${s.description}`)
    .join("\n");

  const systemPrompt =
    `You select which skills are relevant to a user's CLI request. ` +
    `Return ONLY a JSON array of skill names that match. Return [] if none are relevant. ` +
    `No explanation, no markdown, no code fences.`;

  const matchPrompt = `Skills:\n${skillList}\n\nRequest: ${userPrompt}`;

  try {
    const raw = stripCodeFences(
      await callLLM(config, systemPrompt, matchPrompt, 100)
    );
    const names: string[] = JSON.parse(raw);
    const matched = conditionalSkills.filter((s) => names.includes(s.name));
    const result = [...globalSkills, ...matched];
    logSkills(result);
    return result;
  } catch {
    // Fall back to keyword matching on parse/network failure
    const result = matchSkills(skills, userPrompt);
    logSkills(result);
    return result;
  }
}
