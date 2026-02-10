export type Provider = "afm" | "anthropic" | "openai" | "gemini";

export interface GregConfig {
  provider: Provider;
  apiKey?: string;
  model?: string;
}

export interface TerminalContext {
  cwd: string;
  osName: string;
  archName: string;
  history: string;
  dirListing: string;
}
