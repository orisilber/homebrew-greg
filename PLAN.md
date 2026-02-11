# Greg Refactoring Plan

## Goal

Restructure the project to support adding many new features and a native Swift UI layer.

## Current State

~500 lines across 7 flat TypeScript files in `src/` + 1 entry point in `bin/`. One Swift file (`afm-bridge.swift`) for Apple Foundation Models. Key problems:

- `bin/greg.ts` is a monolith (arg parsing, routing, all subcommands, prompt flow, execution)
- `src/shared.ts` mixes types, paths, colors, config I/O, readline, and string utils
- `src/llm.ts` mixes terminal context, prompt building, 3 provider implementations, skill matching, and orchestration
- No separation between CLI, business logic, and infrastructure
- No foundation for UI or additional Swift code

## Target Structure

```
greg/
├── bin/
│   └── greg.ts                     # Thin entry: import router, run
│
├── src/
│   ├── types.ts                    # All shared TypeScript types
│   │
│   ├── config/
│   │   ├── paths.ts                # CONFIG_DIR, CONFIG_FILE, SKILLS_DIR, etc.
│   │   └── config.ts              # loadConfig, saveConfig
│   │
│   ├── cli/
│   │   ├── router.ts              # Arg parsing + dispatch to commands
│   │   └── commands/
│   │       ├── run.ts             # Default: prompt → LLM → display → confirm → execute
│   │       ├── editor.ts          # No-args: open editor to write a prompt
│   │       ├── setup.ts           # --setup interactive config
│   │       └── skills.ts          # --skills add|edit|list|path
│   │
│   ├── llm/
│   │   ├── context.ts             # getTerminalContext (cwd, history, ls)
│   │   ├── prompt.ts              # buildSystemPrompt
│   │   ├── dispatcher.ts          # callLLM (provider switch)
│   │   └── providers/
│   │       ├── anthropic.ts
│   │       ├── openai.ts
│   │       ├── gemini.ts
│   │       └── afm.ts             # callAFM + isAFMSupported + compile + availability
│   │
│   ├── skills/
│   │   ├── loader.ts              # parseSkillFile, loadSkills
│   │   ├── matcher.ts             # tokenize, matchSkills, matchSkillsWithAI
│   │   ├── prompt.ts              # buildSkillsPromptSection
│   │   └── manager.ts             # createSkillFile, listSkills, ensureSkillsDir
│   │
│   ├── safety/
│   │   └── danger.ts              # isDangerous + DANGEROUS_PATTERNS
│   │
│   └── utils/
│       ├── text.ts                # stripCodeFences, future string helpers
│       ├── input.ts               # ask(), confirm(), menu selector
│       └── colors.ts              # C object (ANSI escape helpers)
│
├── swift/
│   ├── afm-bridge.swift           # Existing AFM bridge (moved from src/)
│   └── ui/                        # Native macOS UI layer
│       └── (future Swift UI source files)
│
├── test/                          # Mirrors src/ structure
│   ├── config/
│   │   └── config.test.ts
│   ├── cli/
│   │   └── commands/
│   │       ├── run.test.ts
│   │       └── editor.test.ts
│   ├── llm/
│   │   ├── context.test.ts
│   │   └── prompt.test.ts
│   ├── skills/
│   │   ├── loader.test.ts
│   │   └── matcher.test.ts
│   └── safety/
│       └── danger.test.ts
│
├── scripts/
│   └── release.sh
├── dist/
├── Formula/
└── package.json
```

## Key Decisions

### TypeScript side

- **Thin entry point.** `bin/greg.ts` becomes ~3 lines. All logic moves to `cli/router.ts` which dispatches to command handlers.
- **One file per provider.** Each LLM provider is its own file with a consistent interface. Adding a provider = one file + one line in the dispatcher.
- **One file per command.** Adding a feature (e.g. `greg --history`) = one file in `commands/` + one route in `router.ts`.
- **Types in one place.** `src/types.ts` holds all shared interfaces. No circular dependency risk.

### Swift side

- **`swift/` top-level directory** for all Swift source code.
- `afm-bridge.swift` moves from `src/` to `swift/`.
- `swift/ui/` is where the native macOS UI layer will live.
- TypeScript communicates with Swift via compiled binaries + stdin/stdout (same pattern as the existing AFM bridge).

### Tests

- Mirror `src/` structure under `test/`.
- Each source file gets a corresponding test file.

## Migration Order

Each step is one PR. All existing tests must pass at each step (only import paths change, no logic changes).

### PR 1 — Extract types, config, utils ✅

Move out of `shared.ts`:
- Types → `src/types.ts`
- Paths → `src/config/paths.ts`
- `loadConfig`, `saveConfig` → `src/config/config.ts`
- `C` (colors) → `src/utils/colors.ts`
- `ask()` → `src/utils/input.ts`
- `stripCodeFences` → `src/utils/text.ts`

Delete `shared.ts`. Update all imports.

### PR 2 — Split LLM layer ✅

Break `llm.ts` into:
- `src/llm/context.ts` — `getTerminalContext`
- `src/llm/prompt.ts` — `buildSystemPrompt`
- `src/llm/providers/anthropic.ts` — `callAnthropic`
- `src/llm/providers/openai.ts` — `callOpenAI`
- `src/llm/providers/gemini.ts` — `callGemini`
- `src/llm/providers/afm.ts` — everything from `src/afm.ts`
- `src/llm/dispatcher.ts` — `callLLM`
- Skill matching stays with skills (move `matchSkillsWithAI` to `src/skills/matcher.ts`)
- `getCommand` → `src/cli/commands/run.ts` (or a shared orchestrator)

Move `src/afm-bridge.swift` → `swift/afm-bridge.swift`. Update the path reference in `config/paths.ts`.

### PR 3 — Split CLI + skills ✅

- Create `src/cli/router.ts` — arg parsing and dispatch
- Create `src/cli/commands/run.ts` — the default prompt→execute flow
- Move editor → `src/cli/commands/editor.ts`
- Move setup → `src/cli/commands/setup.ts`
- Move skills subcommands → `src/cli/commands/skills.ts`
- Move skills logic → `src/skills/loader.ts`, `matcher.ts`, `prompt.ts`, `manager.ts`
- Move danger → `src/safety/danger.ts`
- Thin `bin/greg.ts` to just call the router

### PR 4 — Restructure tests + add `swift/ui/` ✅

- Move tests to mirror `src/` structure
- Create `swift/ui/` directory
- Update build script to handle `swift/` source path
- Ready for new features
