import { C, ask, loadConfig, setup, getCommand, editorMode, isDangerous, listSkills, createSkillFile, SKILLS_DIR } from "../src";
import { spawnSync } from "child_process";

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // --setup: reconfigure
  if (args[0] === "--setup") {
    await setup();
    return;
  }

  // --skills: manage skills
  if (args[0] === "--skills") {
    const sub = args[1];

    if (sub === "add" && args[2]) {
      const filePath = createSkillFile(args[2]);
      const editor = process.env.EDITOR || "vim";
      spawnSync(editor, [filePath], { stdio: "inherit" });
      console.error(C.green(`Skill saved: ${filePath}`));
      return;
    }

    if (sub === "edit" && args[2]) {
      const skills = listSkills();
      const match = skills.find((s) => s.name === args[2]);
      if (!match) {
        console.error(C.red(`Skill "${args[2]}" not found.`));
        console.error(C.dim("Available skills: " + (skills.map((s) => s.name).join(", ") || "none")));
        process.exit(1);
      }
      const filePath = `${SKILLS_DIR}/${args[2]}.md`;
      const editor = process.env.EDITOR || "vim";
      spawnSync(editor, [filePath], { stdio: "inherit" });
      console.error(C.green(`Skill updated: ${filePath}`));
      return;
    }

    if (sub === "list" || !sub) {
      const skills = listSkills();
      if (skills.length === 0) {
        console.error(C.dim("No skills found."));
        console.error(C.dim(`Add one with: greg --skills add <name>`));
        console.error(C.dim(`Skills directory: ${SKILLS_DIR}`));
      } else {
        console.error(C.bold("Skills:\n"));
        for (const s of skills) {
          console.error(`  ${C.green(s.name)}  ${C.dim(s.description)}`);
        }
        console.error("");
        console.error(C.dim(`Directory: ${SKILLS_DIR}`));
      }
      return;
    }

    if (sub === "path") {
      console.log(SKILLS_DIR);
      return;
    }

    console.error(C.bold("Usage:"));
    console.error(`  greg --skills              ${C.dim("List all skills")}`);
    console.error(`  greg --skills list         ${C.dim("List all skills")}`);
    console.error(`  greg --skills add <name>   ${C.dim("Create and edit a new skill")}`);
    console.error(`  greg --skills edit <name>  ${C.dim("Edit an existing skill")}`);
    console.error(`  greg --skills path         ${C.dim("Print skills directory path")}`);
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
