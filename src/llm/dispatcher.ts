import type { GregConfig, GenerationOptions } from "../types";
import { callAFM } from "./providers/afm";
import { callAnthropic } from "./providers/anthropic";
import { callOpenAI } from "./providers/openai";
import { callGemini } from "./providers/gemini";
import { callOpenRouter } from "./providers/openrouter";

export function callLLM(config: GregConfig, systemPrompt: string, userPrompt: string, options: GenerationOptions = {}): Promise<string> {
  options.signal?.throwIfAborted();
  switch (config.provider) {
    case "afm": return callAFM(systemPrompt, userPrompt, options);
    case "anthropic": return callAnthropic(config, systemPrompt, userPrompt, options);
    case "gemini": return callGemini(config, systemPrompt, userPrompt, options);
    case "openrouter": return callOpenRouter(config, systemPrompt, userPrompt, options);
    case "openai": return callOpenAI(config, systemPrompt, userPrompt, options);
    default: { const exhaustive: never = config.provider; throw new Error(`Unsupported provider: ${exhaustive}`); }
  }
}
