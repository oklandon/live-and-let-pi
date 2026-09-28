# live-and-let-pi

Personal extensions for the [pi](https://github.com/earendil-works/pi-mono) coding agent harness: token/cost visibility, cheaper compaction, git-worktree-isolated subagent teams, and an optional local Ollama provider. Installable on any machine straight from this repo.

## Install

```bash
pi install git:github.com/<you>/live-and-let-pi
```

Writes an entry to `~/.pi/agent/settings.json`'s `packages` array. Extensions and prompts auto-load on next start (or `/reload`).

To iterate locally before pushing:

```bash
pi install /absolute/path/to/live-and-let-pi
```

Update on any machine later:

```bash
pi update --extensions
```

## What's in here

### `extensions/context-status/`
Always-on footer: cumulative `↑input ↓output`, prompt-cache hit rate, running cost, and how close the active context is to triggering compaction. Toggle with `/context-status`.

### `extensions/cheap-compaction/`
Runs auto-compaction summaries on a cheaper/faster model (default `anthropic/claude-haiku-4-5`) instead of your main conversation model. Falls back to pi's default compaction if the configured model/auth isn't available. Configure via `PI_LIVE_AND_LET_PI_COMPACTION_PROVIDER` / `PI_LIVE_AND_LET_PI_COMPACTION_MODEL` env vars.

### `extensions/worktree-team/`
Subagent delegation tool (`worktree_team`), adapted from pi's own bundled `subagent` example. Single / parallel / chain modes, each task optionally running in its own `git worktree` on a scratch branch (`useWorktree: true`), merged back into the current branch automatically on success. Failed tasks and merge conflicts leave the worktree and branch in place for manual inspection instead of discarding work.

Bundled agent personas (`agents/scout.md`, `planner.md`, `reviewer.md`, `worker.md`) load automatically — no manual symlinking needed, unlike the upstream example. Bundled workflow prompts live in `prompts/`: `/implement`, `/scout-and-plan`, `/implement-and-review`, `/parallel-worktrees`.

### `extensions/ollama-provider/`
Registers a local Ollama server's models with pi (`openai-completions` API), but only if one is actually reachable on `http://127.0.0.1:11434` at startup — safe to install on machines without Ollama.

### `settings.snippet.json`
Reference compaction tuning to copy into `~/.pi/agent/settings.json` by hand (settings.json isn't a package resource type, so this isn't auto-applied).

## Models

Hosted providers (Anthropic, OpenAI, ...) need no package code — `/login <provider>` or the provider's API key env var. Local open-weight models: prefer pi's native [llama.cpp router support](https://github.com/earendil-works/pi-mono) (`/login llama.cpp`, then `/llama` to manage GGUF models) when possible; use `ollama-provider` here for Ollama specifically.

## Development

Edit any file under `extensions/`, then run `/reload` in an active pi session to pick up changes without restarting.
