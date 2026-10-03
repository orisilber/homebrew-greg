import type { GregConfig, GenerationOptions } from "../../types";
import { requestStream, streamEvents, object, apiError, textCollector } from "../stream";

export async function callAnthropic(config: GregConfig, systemPrompt: string, userPrompt: string, options: GenerationOptions = {}): Promise<string> {
  const response = await requestStream("https://api.anthropic.com/v1/messages", {
    "x-api-key": config.apiKey ?? "", "anthropic-version": "2023-06-01",
  }, {
    model: config.model, max_tokens: options.maxTokens ?? 1024, stream: true,
    system: systemPrompt, messages: [{ role: "user", content: userPrompt }],
  }, options.signal);
  const output = textCollector(options);
  let complete = false;
  let stopReason: unknown;
  for await (const event of streamEvents(response)) {
    const json: unknown = JSON.parse(event);
    const error = apiError(json);
    if (error) throw new Error(error);
    const record = object(json);
    if (record.type === "content_block_delta") {
      const delta = object(record.delta);
      if (delta.type === "text_delta") output.append(delta.text);
    }
    if (record.type === "message_delta") stopReason = object(record.delta).stop_reason;
    if (record.type === "message_stop") complete = true;
  }
  if (!complete || (stopReason !== "end_turn" && stopReason !== "stop_sequence")) {
    throw new Error(`Incomplete command: ${String(stopReason ?? "interrupted stream")}.`);
  }
  return output.result();
}
