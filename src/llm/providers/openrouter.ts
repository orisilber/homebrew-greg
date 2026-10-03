import type { GregConfig, GenerationOptions } from "../../types";
import { callOpenAI } from "./openai";

export function callOpenRouter(config: GregConfig, systemPrompt: string, userPrompt: string, options: GenerationOptions = {}): Promise<string> {
  return callOpenAI(config, systemPrompt, userPrompt, options, "https://openrouter.ai/api/v1/chat/completions");
}
