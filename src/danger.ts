const DANGEROUS_PATTERNS: RegExp[] = [
  // File deletion
  /\brm\b/,
  /\brmdir\b/,
  /\bunlink\b/,
  /\btrash\b/,

  // File/dir modification & moves
  /\bmv\b/,
  /\bcp\b/,
  /\bchmod\b/,
  /\bchown\b/,
  /\bchgrp\b/,
  /\btruncate\b/,
  /\bmkdir\b/,
  /\btouch\b/,
  /\bln\b/,

  // Write redirection
  /[^|]>/,        // > but not |> (covers > and >>)
  /\btee\b/,
  /\bdd\b/,

  // In-place editing
  /\bsed\s.*-i\b/,
  /\bperl\s.*-[ip]/,
  /\bpatch\b/,

  // Package / install / uninstall
  /\bbrew\s+(install|uninstall|remove|cleanup|autoremove)\b/,
  /\bnpm\s+(install|uninstall|remove|ci|link|prune)\b/,
  /\bbun\s+(install|remove|link|add)\b/,
  /\bpip\s+(install|uninstall)\b/,
  /\bapt(-get)?\s+(install|remove|purge|autoremove)\b/,

  // Git destructive
  /\bgit\s+(push|reset|clean|checkout\s+--?\s|stash\s+drop|branch\s+-[dD]|rebase|merge|commit|add|tag\s+-d)\b/,

  // Process / system
  /\bsudo\b/,
  /\bkill\b/,
  /\bkillall\b/,
  /\bpkill\b/,
  /\bshutdown\b/,
  /\breboot\b/,
  /\blaunchctl\b/,
  /\bsystemctl\b/,

  // Docker destructive
  /\bdocker\s+(rm|rmi|prune|stop|kill|system\s+prune)\b/,

  // Disk / format
  /\bmkfs\b/,
  /\bfdisk\b/,
  /\bdiskutil\b/,

  // Curl/wget with side effects
  /\bcurl\b.*-[Xx]\s*(POST|PUT|DELETE|PATCH)/,
  /\bcurl\b.*-o\b/,
  /\bwget\b/,
];

export function isDangerous(command: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
}
