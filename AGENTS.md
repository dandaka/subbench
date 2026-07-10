# Project docs

Key documents in `docs/` (read the relevant one before working):

- [docs/goal.md](docs/goal.md) — project goal
- [docs/protocol.md](docs/protocol.md) — measurement protocol. **Read before running or modifying any benchmark.** Section 2 carries a mandatory operator isolation check that must be confirmed and recorded before every run, or the run is invalid.
- [docs/methodology.md](docs/methodology.md) — methodology
- [docs/why-calibration.md](docs/why-calibration.md) — why calibration is needed (the "why not just use tokens?" answer)
- [docs/open-questions.md](docs/open-questions.md) — open questions, including whether to reverse-engineer subscription structure
- [docs/calibration-tasks.md](docs/calibration-tasks.md) — calibration task set
- [docs/running-claude-max-calibration.md](docs/running-claude-max-calibration.md) — operator runbook: how to run a Claude Max calibration test
- [docs/research.md](docs/research.md) — supporting research and external context
- [docs/log.md](docs/log.md) — concise record of important project changes

# Project log

Record every important, durable project change in [docs/log.md](docs/log.md) in the
same change set. Include the date, a short summary, and the affected artifacts or
decisions. Do not log routine formatting, dependency-only updates, or transient run
output. Never use the log as a substitute for required measurement evidence.

# Benchmarking protocol

The measurement protocol lives in [docs/protocol.md](docs/protocol.md). Read it before
running or modifying any benchmark. In particular, **Section 2 (Prepare isolation)** carries
a mandatory operator check: before every run, the operator must manually verify and record
confirmation that nothing else is consuming the subscription (other Claude Code sessions,
background agents, cron/scheduled tasks, `/loop` runs, MCP servers/daemons, or teammates
sharing the seat). A run without a recorded confirmation is invalid and must be discarded.

# context-mode — MANDATORY routing rules

You have context-mode MCP tools available. These rules are NOT optional — they protect your context window from flooding. A single unrouted command can dump 56 KB into context and waste the entire session.

## BLOCKED commands — do NOT attempt these

### curl / wget — BLOCKED
Any Bash command containing `curl` or `wget` is intercepted and replaced with an error message. Do NOT retry.
Instead use:
- `ctx_fetch_and_index(url, source)` to fetch and index web pages
- `ctx_execute(language: "javascript", code: "const r = await fetch(...)")` to run HTTP calls in sandbox

### Inline HTTP — BLOCKED
Any Bash command containing `fetch('http`, `requests.get(`, `requests.post(`, `http.get(`, or `http.request(` is intercepted and replaced with an error message. Do NOT retry with Bash.
Instead use:
- `ctx_execute(language, code)` to run HTTP calls in sandbox — only stdout enters context

### WebFetch — BLOCKED
WebFetch calls are denied entirely. The URL is extracted and you are told to use `ctx_fetch_and_index` instead.
Instead use:
- `ctx_fetch_and_index(url, source)` then `ctx_search(queries)` to query the indexed content

## REDIRECTED tools — use sandbox equivalents

### Bash (>20 lines output)
Bash is ONLY for: `git`, `mkdir`, `rm`, `mv`, `cd`, `ls`, `npm install`, `pip install`, and other short-output commands.
For everything else, use:
- `ctx_batch_execute(commands, queries)` — run multiple commands + search in ONE call
- `ctx_execute(language: "shell", code: "...")` — run in sandbox, only stdout enters context

### Read (for analysis)
If you are reading a file to **Edit** it → Read is correct (Edit needs content in context).
If you are reading to **analyze, explore, or summarize** → use `ctx_execute_file(path, language, code)` instead. Only your printed summary enters context. The raw file content stays in the sandbox.

### Grep (large results)
Grep results can flood context. Use `ctx_execute(language: "shell", code: "grep ...")` to run searches in sandbox. Only your printed summary enters context.

## Tool selection hierarchy

1. **GATHER**: `ctx_batch_execute(commands, queries)` — Primary tool. Runs all commands, auto-indexes output, returns search results. ONE call replaces 30+ individual calls.
2. **FOLLOW-UP**: `ctx_search(queries: ["q1", "q2", ...])` — Query indexed content. Pass ALL questions as array in ONE call.
3. **PROCESSING**: `ctx_execute(language, code)` | `ctx_execute_file(path, language, code)` — Sandbox execution. Only stdout enters context.
4. **WEB**: `ctx_fetch_and_index(url, source)` then `ctx_search(queries)` — Fetch, chunk, index, query. Raw HTML never enters context.
5. **INDEX**: `ctx_index(content, source)` — Store content in FTS5 knowledge base for later search.

## Subagent routing

When spawning subagents (Agent/Task tool), the routing block is automatically injected into their prompt. Bash-type subagents are upgraded to general-purpose so they have access to MCP tools. You do NOT need to manually instruct subagents about context-mode.

## Output constraints

- Keep responses under 500 words.
- Write artifacts (code, configs, PRDs) to FILES — never return them as inline text. Return only: file path + 1-line description.
- When indexing content, use descriptive source labels so others can `ctx_search(source: "label")` later.

## ctx commands

| Command | Action |
|---------|--------|
| `ctx stats` | Call the `ctx_stats` MCP tool and display the full output verbatim |
| `ctx doctor` | Call the `ctx_doctor` MCP tool, run the returned shell command, display as checklist |
| `ctx upgrade` | Call the `ctx_upgrade` MCP tool, run the returned shell command, display as checklist |
