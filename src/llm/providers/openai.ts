import type { GregConfig, GenerationOptions } from "../../types";
import { requestStream, streamEvents, object, apiError, textCollector } from "../stream";

export async function callOpenAI(
  config: GregConfig, systemPrompt: string, userPrompt: string,
  options: GenerationOptions = {}, url = "https://api.openai.com/v1/chat/completions"
): Promise<string> {
  const response = await requestStream(url, { Authorization: `Bearer ${config.apiKey}` }, {
    model: config.model, stream: true,
    ...(config.provider === "openrouter" ? { max_tokens: options.maxTokens ?? 1024 }
      : { max_completion_tokens: options.maxTokens ?? 1024 }),
    messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
  }, options.signal);
  const output = textCollector(options);
  let complete = false;
  for await (const event of streamEvents(response)) {
    if (event === "[DONE]") break;
    const json: unknown = JSON.parse(event);
    const error = apiError(json);
    if (error) throw new Error(error);
    const choices = object(json).choices;
    if (!Array.isArray(choices)) continue;
    const choice = object(choices[0]);
    const delta = object(choice.delta);
    if (delta.refusal) throw new Error("Provider declined to generate a command.");
    output.append(delta.content);
    if (choice.finish_reason === "stop") complete = true;
    else if (choice.finish_reason != null) throw new Error(`Incomplete command: ${String(choice.finish_reason)}.`);
  }
  if (!complete) throw new Error("Provider stream ended before completing the command.");
  return output.result();
}
