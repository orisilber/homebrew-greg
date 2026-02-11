export type Provider = "afm" | "anthropic" | "openai" | "gemini";

export type HotkeyModifier = "Command" | "Option" | "Shift" | "Control";

export interface HotkeyConfig {
  key: string;
  modifiers: HotkeyModifier[];
}

export interface GregConfig {
  provider: Provider;
  apiKey?: string;
  model?: string;
  hotkey?: HotkeyConfig;
}

export interface TerminalContext {
  cwd: string;
  osName: string;
  archName: string;
  history: string;
  dirListing: string;
}
