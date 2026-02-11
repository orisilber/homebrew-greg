import type { GregConfig } from "../../types";

export async function callAnthropic(
  config: GregConfig, systemPrompt: string, userPrompt: string, maxTokens: number = 1024
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": config.apiKey!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: config.model, max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  const data = (await res.json()) as any;
  if (data.error) throw new Error(data.error.message);
  return data.content?.[0]?.text ?? "";
}
