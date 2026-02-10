import { homedir } from "os";
import { join, dirname } from "path";

const __dirname = dirname(new URL(import.meta.url).pathname);

export const CONFIG_DIR = join(homedir(), ".config", "greg");
export const CONFIG_FILE = join(CONFIG_DIR, "config.json");
export const SKILLS_DIR = join(CONFIG_DIR, "skills");
export const AFM_SWIFT_SRC = join(__dirname, "..", "afm-bridge.swift");
export const AFM_BINARY = join(CONFIG_DIR, "afm-bridge");
