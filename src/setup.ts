import type { GregConfig, Provider } from "./types";
import { C } from "./utils/colors";
import { ask } from "./utils/input";
import { saveConfig } from "./config/config";
import { CONFIG_FILE } from "./config/paths";
import { isAFMSupported, ensureAFMBinary, checkAFMAvailability } from "./afm";

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o-mini",
  gemini: "gemini-2.5-flash",
};

export async function setup(): Promise<GregConfig> {
  console.error("");
  console.error(C.bold("Welcome to Greg! Let's get you set up.\n"));

  const afmSupported = isAFMSupported();
  let provider: Provider;

  while (true) {
    let menu = "Provider:\n";
    if (afmSupported) {
      menu += `  ${C.green("1")} Apple Intelligence (on-device, no API key)\n`;
      menu += `  ${C.green("2")} Anthropic (Claude)\n`;
      menu += `  ${C.green("3")} OpenAI (GPT)\n`;
      menu += `  ${C.green("4")} Google Gemini\n`;
      menu += `\nChoose [1/2/3/4]: `;
    } else {
      menu += `  ${C.green("1")} Anthropic (Claude)\n`;
      menu += `  ${C.green("2")} OpenAI (GPT)\n`;
      menu += `  ${C.green("3")} Google Gemini\n`;
      menu += `\nChoose [1/2/3]: `;
    }

    const choice = await ask(menu);

    if (afmSupported) {
      if (choice === "1") { provider = "afm"; break; }
      if (choice === "2") { provider = "anthropic"; break; }
      if (choice === "3") { provider = "openai"; break; }
      if (choice === "4") { provider = "gemini"; break; }
    } else {
      if (choice === "1") { provider = "anthropic"; break; }
      if (choice === "2") { provider = "openai"; break; }
      if (choice === "3") { provider = "gemini"; break; }
    }
    console.error(C.red("Invalid choice."));
  }

  let config: GregConfig;

  if (provider === "afm") {
    console.error(C.dim("\nCompiling AFM bridge..."));
    if (!ensureAFMBinary()) {
      console.error(
        C.red("Failed to compile. Is Xcode Command Line Tools installed?")
      );
      process.exit(1);
    }

    const status = checkAFMAvailability();
    if (status === "available") {
      console.error(C.green("Apple Intelligence is available."));
    } else if (status.includes("appleIntelligenceNotEnabled")) {
      console.error(C.yellow("Apple Intelligence is not enabled."));
      console.error(C.dim("Enable it in System Settings > Apple Intelligence & Siri."));
      console.error(C.dim("Saving config anyway -- Greg will work once enabled.\n"));
    } else if (status.includes("modelNotReady")) {
      console.error(C.yellow("Model is still downloading. Try again shortly."));
    } else {
      console.error(C.yellow(`AFM status: ${status}`));
      console.error(C.dim("Saving config anyway.\n"));
    }

    config = { provider: "afm" };
  } else {
    const keyHints: Record<string, string> = {
      anthropic: "sk-ant-api03-...",
      openai: "sk-proj-...",
      gemini: "AIza...",
    };

    let key: string;
    while (true) {
      key = await ask(`\nAPI key (${C.dim(keyHints[provider])}): `);
      if (key) break;
      console.error(C.red("Please enter a valid key."));
    }

    config = { provider, apiKey: key, model: DEFAULT_MODELS[provider] };
  }

  saveConfig(config);
  console.error(C.green(`\nSaved to ${CONFIG_FILE}`));
  console.error(C.dim("You can edit this file or run `greg --setup` anytime.\n"));

  return config;
}
