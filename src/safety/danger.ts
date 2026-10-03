/**
 * Only recognized, simple read commands run automatically. This is a conservative
 * confirmation policy, not a shell sandbox. Unknown syntax always needs approval.
 */
function simpleWords(command: string): string[] | null {
  const words: string[] = [];
  let word = "";
  let quote = "";
  let started = false;
  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    if (quote === "'") {
      if (char === "'") quote = ""; else word += char;
      continue;
    }
    if (char === "\\") {
      if (i + 1 >= command.length) return null;
      word += command[++i]; started = true; continue;
    }
    if (char === "$" || char === "`" || char === "\n" || char === "\r") return null;
    if (quote === '"') {
      if (char === '"') quote = ""; else word += char;
      continue;
    }
    if (char === "'" || char === '"') { quote = char; started = true; continue; }
    if (/[|;&><(){}#]/.test(char)) return null;
    if (char === " " || char === "\t") {
      if (started) { words.push(word); word = ""; started = false; }
    } else { word += char; started = true; }
  }
  if (quote) return null;
  if (started) words.push(word);
  return words;
}

const readCommands = new Set(["ls", "cat", "head", "tail", "wc", "pwd", "du", "stat", "which", "type", "uname", "whoami", "ps", "echo"]);

export function isDangerous(command: string): boolean {
  const words = simpleWords(command);
  if (!words?.length) return true;
  const [program, ...args] = words;
  if (readCommands.has(program)) return false;
  if (program === "tree") return args.some(arg => /^-[^-]*o/.test(arg));
  if (program === "file") return args.some(arg => /^(-[^-]*C|--compile(?:=|$))/.test(arg));
  if (program === "date") return args.some(arg => !arg.startsWith("+") && arg !== "-u" && arg !== "-R" && arg !== "-I");
  if (program === "grep") return args.some(arg => arg.startsWith("--exclude-from="));
  if (program === "rg") return args.some(arg => /^(--pre(?:=|$)|--hostname-bin(?:=|$)|--files-with-matches=)/.test(arg));
  if (program === "sort") return args.some(arg => /^(-[^-]*o|--output(?:=|$))/.test(arg));
  if (program === "find") {
    const writeOptions = new Set(["-delete", "-exec", "-execdir", "-ok", "-okdir", "-fprint", "-fprint0", "-fprintf", "-fls"]);
    return args.some(arg => writeOptions.has(arg));
  }
  if (program === "git") {
    let i = 0;
    while (i < args.length) {
      if (args[i] === "-C") { if (!args[i + 1]) return true; i += 2; }
      else if (args[i] === "--no-pager") i++;
      else break;
    }
    const subcommand = args[i];
    if (!["status", "log", "diff", "show", "ls-files", "rev-parse"].includes(subcommand ?? "")) return true;
    return args.slice(i + 1).some(arg => /^(--ext-diff|--textconv|--output(?:=|$))/.test(arg));
  }
  if (program === "curl") {
    const flags = new Set(["-I", "--head", "-s", "--silent", "-S", "--show-error", "-L", "--location", "-f", "--fail", "-i", "--include"]);
    return args.some(arg => !flags.has(arg) && !/^https?:\/\//.test(arg));
  }
  return true;
}
