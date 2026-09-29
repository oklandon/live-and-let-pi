# live-and-let-pi

My whole [pi](https://github.com/earendil-works/pi-mono) setup as one package: my own extensions (token/cost visibility, cheaper compaction, git-worktree-isolated subagent teams, an optional local Ollama provider, grill-me) plus a curated set of third-party pi packages pulled in as npm dependencies. Installable on any machine straight from this repo.

## Install

```bash
pi install git:github.com/oklandon/live-and-let-pi
```

Writes an entry to `~/.pi/agent/settings.json`'s `packages` array and runs `npm install` for the bundled third-party packages. Extensions, skills, and prompts auto-load on next start (or `/reload`).

This package is meant to be the *only* entry in `packages`. Don't also install the bundled third-party packages individually — their tools will conflict.

To iterate locally before pushing (local installs don't run `npm install` for you):

```bash
cd /absolute/path/to/live-and-let-pi && npm install
pi install /absolute/path/to/live-and-let-pi
```

Update on any machine later:

```bash
pi update --extensions
```

## Bundled third-party packages

Declared in `package.json` `dependencies` and loaded via `node_modules/...` paths in the `pi` manifest (mirroring each package's own manifest):

| Package | Provides |
|---|---|
| `pi-ask-user` | `ask_user` tool + skill |
| `pi-autoresearch` | experiment-loop tools + skills |
| `pi-btw` | `/btw` side conversations + skill |
| `pi-subagents` | subagent tools, skills, workflow prompts (`/council`, `/review-loop`, `/parallel-*`, ...) |
| `pi-mcp-adapter` | `mcp` / `mcpScript` gateway |
| `pi-web-access` | web search/fetch tools |
| `pi-simplify` | simplify extension |
| `pi-rtk-optimizer` | rtk optimizer extension |
| `@juanibiapina/pi-powerbar` | status powerbar (+ `pi-usage`) |

`.npmrc` sets `legacy-peer-deps=true` because some of these declare peer ranges on `@earendil-works/pi-coding-agent` older than current pi.

To update one: bump its version in `package.json`, `npm install`, commit, then `pi update --extensions` on each machine.

## My extensions

### `extensions/context-status/`
Always-on footer: cumulative `↑input ↓output`, prompt-cache hit rate, running cost, and how close the active context is to triggering compaction. Toggle with `/context-status`.

### `extensions/cheap-compaction/`
Runs auto-compaction summaries on a cheaper/faster model (default `anthropic/claude-haiku-4-5`) instead of your main conversation model. Falls back to pi's default compaction if the configured model/auth isn't available. Configure via `PI_LIVE_AND_LET_PI_COMPACTION_PROVIDER` / `PI_LIVE_AND_LET_PI_COMPACTION_MODEL` env vars.

### `extensions/worktree-team/`
Subagent delegation tool (`worktree_team`), adapted from pi's own bundled `subagent` example. Single / parallel / chain modes, each task optionally running in its own `git worktree` on a scratch branch (`useWorktree: true`), merged back into the current branch automatically on success. Failed tasks and merge conflicts leave the worktree and branch in place for manual inspection instead of discarding work.

Bundled agent personas (`agents/scout.md`, `planner.md`, `reviewer.md`, `worker.md`) load automatically — no manual symlinking needed, unlike the upstream example. Bundled workflow prompts live in `prompts/`: `/implement`, `/scout-and-plan`, `/implement-and-review`, `/parallel-worktrees`.

### `extensions/ollama-provider/`
Registers a local Ollama server's models with pi (`openai-completions` API), but only if one is actually reachable on `http://127.0.0.1:11434` at startup — safe to install on machines without Ollama. Probe timeout via `PI_LIVE_AND_LET_PI_OLLAMA_PROBE_TIMEOUT_MS`.

### `extensions/grill-me-simple.ts`
Socratic "grill me" planning sessions (formerly the standalone local `pi-grill-me-simple` package).

### `settings.snippet.json`
Reference compaction tuning to copy into `~/.pi/agent/settings.json` by hand (settings.json isn't a package resource type, so this isn't auto-applied).

## Models

Hosted providers (Anthropic, OpenAI, ...) need no package code — `/login <provider>` or the provider's API key env var. Local open-weight models: prefer pi's native [llama.cpp router support](https://github.com/earendil-works/pi-mono) (`/login llama.cpp`, then `/llama` to manage GGUF models) when possible; use `ollama-provider` here for Ollama specifically.

## Development

Edit any file under `extensions/`, then run `/reload` in an active pi session to pick up changes without restarting.
