import type { GregConfig } from "../types";
import { callAFM } from "./providers/afm";
import { callAnthropic } from "./providers/anthropic";
import { callOpenAI } from "./providers/openai";
import { callGemini } from "./providers/gemini";

export async function callLLM(
  config: GregConfig, systemPrompt: string, userPrompt: string, maxTokens: number = 1024
): Promise<string> {
  switch (config.provider) {
    case "afm":       return callAFM(systemPrompt, userPrompt);
    case "anthropic":  return await callAnthropic(config, systemPrompt, userPrompt, maxTokens);
    case "gemini":     return await callGemini(config, systemPrompt, userPrompt, maxTokens);
    case "openai": default:
      return await callOpenAI(config, systemPrompt, userPrompt, maxTokens);
  }
}
