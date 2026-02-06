import { C, ask, loadConfig, setup, getCommand, editorMode, isDangerous } from "../src";

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // --setup: reconfigure
  if (args[0] === "--setup") {
    await setup();
    return;
  }

  // No args: open editor, run the script directly
  if (args.length === 0) {
    editorMode();
    return;
  }

  // Load or create config
  let config = loadConfig();
  if (!config) {
    config = await setup();
  }

  const prompt = args.join(" ");

  // Call LLM
  let command: string;
  try {
    command = await getCommand(config, prompt);
  } catch (err: any) {
    console.error(C.red(`\nAPI error: ${err.message}`));
    if (
      err.message.includes("auth") ||
      err.message.includes("key") ||
      err.message.includes("401") ||
      err.message.includes("unavailable")
    ) {
      console.error(C.dim("Run `greg --setup` to reconfigure."));
    }
    process.exit(1);
  }

  if (!command) {
    console.error(C.red("No command generated."));
    process.exit(1);
  }

  // Display
  console.error("");
  console.error(C.dim("─────────────────────────────────────────"));
  console.error(`  ${C.greenBold(command)}`);
  console.error(C.dim("─────────────────────────────────────────"));
  console.error("");

  // Only ask for confirmation if the command is potentially destructive
  if (isDangerous(command)) {
    const choice = await ask(
      `${C.yellow("⚠ This may modify files or have side effects. Run?")} [${C.green("Y")}/${C.red("n")}] `
    );

    if (choice.toLowerCase() === "n") {
      console.error(C.dim("Aborted."));
      process.exit(0);
    }
  }

  // Execute
  try {
    const { execSync } = await import("child_process");
    execSync(command, { stdio: "inherit", shell: "/bin/zsh" });
  } catch (err: any) {
    process.exit(err.status ?? 1);
  }
}

main();
