import type { GenerationOptions } from "../types";

export function object(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function apiError(value: unknown): string | undefined {
  const error = object(object(value).error);
  return typeof error.message === "string" ? error.message : undefined;
}

export async function requestStream(url: string, headers: Record<string, string>, body: unknown, signal?: AbortSignal): Promise<Response> {
  const response = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body), signal,
  });
  if (!response.ok) {
    let message: string | undefined;
    try { message = apiError(await response.json()); } catch { signal?.throwIfAborted(); }
    throw new Error(message ?? `Provider returned HTTP ${response.status}.`);
  }
  return response;
}

/** Decode SSE events across arbitrary byte boundaries, CRLF, and multiline data. */
export async function* streamEvents(response: Response): AsyncGenerator<string> {
  if (!response.body) throw new Error("Provider returned an empty stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let data: string[] = [];
  const consumeLine = (line: string): string | undefined => {
    if (line.endsWith("\r")) line = line.slice(0, -1);
    if (line === "") {
      if (data.length === 0) return undefined;
      const event = data.join("\n"); data = []; return event;
    }
    if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    return undefined;
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      if (buffer.length > 1_048_576) throw new Error("Provider stream event is too large.");
      let end: number;
      while ((end = buffer.indexOf("\n")) !== -1) {
        const event = consumeLine(buffer.slice(0, end)); buffer = buffer.slice(end + 1);
        if (event !== undefined) yield event;
      }
      if (done) break;
    }
    if (buffer) consumeLine(buffer);
    if (data.length) yield data.join("\n");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function textCollector(options: GenerationOptions) {
  let text = "";
  return {
    append(chunk: unknown) {
      if (typeof chunk !== "string" || !chunk) return;
      text += chunk;
      if (text.length > 65_536) throw new Error("Generated command is too long.");
      options.onText?.(chunk);
    },
    result() { return text; },
  };
}
