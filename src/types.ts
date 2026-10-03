export type Provider = "afm" | "anthropic" | "openai" | "gemini" | "openrouter";

export interface GregConfig {
  provider: Provider;
  apiKey?: string;
  model?: string;
  customInstructions?: string;
  includeHistory?: boolean;
  timeoutMs?: number;
}

export interface TerminalContext {
  cwd: string;
  osName: string;
  archName: string;
  history: string;
  dirListing: string;
}

export interface GenerationOptions {
  signal?: AbortSignal;
  onText?: (text: string) => void;
  maxTokens?: number;
}

export type RunMode = "execute" | "preview" | "copy";

export interface RunOptions {
  mode?: RunMode;
  timings?: boolean;
  timeoutMs?: number;
  stream?: boolean;
}
