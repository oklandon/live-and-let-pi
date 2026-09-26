---
description: Run several independent worker tasks in parallel, each isolated in its own git worktree, merging back on success
---
Use the subagent tool with the tasks parameter to run these in parallel, each with useWorktree: true so each worker gets its own git worktree and branch, merged back into the current branch automatically on success:

$@

Report which tasks merged cleanly and which need manual conflict resolution.
