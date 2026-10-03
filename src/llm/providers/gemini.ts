import type { GregConfig, GenerationOptions } from "../../types";
import { requestStream, streamEvents, object, apiError, textCollector } from "../stream";

export async function callGemini(config: GregConfig, systemPrompt: string, userPrompt: string, options: GenerationOptions = {}): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model ?? "")}:streamGenerateContent?alt=sse`;
  const response = await requestStream(url, { "x-goog-api-key": config.apiKey ?? "" }, {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      maxOutputTokens: options.maxTokens ?? 1024,
      // The default 2.5 Flash model supports disabling thinking for short commands.
      ...(config.model?.startsWith("gemini-2.5-flash") && !config.model.includes("image")
        ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    },
  }, options.signal);
  const output = textCollector(options);
  let complete = false;
  for await (const event of streamEvents(response)) {
    const json: unknown = JSON.parse(event);
    const error = apiError(json);
    if (error) throw new Error(error);
    const record = object(json);
    if (object(record.promptFeedback).blockReason) throw new Error("Provider declined to generate a command.");
    if (!Array.isArray(record.candidates)) continue;
    const candidate = object(record.candidates[0]);
    const parts = object(candidate.content).parts;
    if (Array.isArray(parts)) {
      for (const part of parts) { const item = object(part); if (!item.thought) output.append(item.text); }
    }
    if (candidate.finishReason === "STOP") complete = true;
    else if (candidate.finishReason) throw new Error(`Incomplete command: ${String(candidate.finishReason)}.`);
  }
  if (!complete) throw new Error("Provider stream ended before completing the command.");
  return output.result();
}
