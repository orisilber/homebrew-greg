import { spawnSync } from "child_process";
import { C } from "../../utils/colors";
import { SKILLS_DIR } from "../../config/paths";
import { listSkills, createSkillFile } from "../../skills/manager";

export async function skillsCommand(args: string[]): Promise<void> {
  const sub = args[0];

  if (sub === "add" && args[1]) {
    const filePath = createSkillFile(args[1]);
    const editor = process.env.EDITOR || "vim";
    spawnSync(editor, [filePath], { stdio: "inherit" });
    console.error(C.green(`Skill saved: ${filePath}`));
    return;
  }

  if (sub === "edit" && args[1]) {
    const skills = listSkills();
    const match = skills.find((s) => s.name === args[1]);
    if (!match) {
      console.error(C.red(`Skill "${args[1]}" not found.`));
      console.error(C.dim("Available skills: " + (skills.map((s) => s.name).join(", ") || "none")));
      process.exit(1);
    }
    const filePath = `${SKILLS_DIR}/${args[1]}.md`;
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
}
