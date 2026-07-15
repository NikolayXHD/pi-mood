# pi-mood

## Why

LLM agents routinely ignore simple rules, even when they are clearly stated in
AGENTS.md. The rules are there — in the system prompt — but after a few dozens
of tool calls they get buried under conversation history.

Yet the same LLM follows "plan mode" instructions e.g. in opencode. Plan mode
works because it injects a reminder **directly into the user message**, not
from the distant system prompt. So the model **can** follow rules — it just
needs them close to the generation point.

Periodic injection of your own rules throughout a session should therefore make
the agent substantially more reliable. The same principle powers steering mode
in Roo-Code.

pi-mood is a minimal implementation of this idea. You annotate existing
AGENTS.md headings with desired relative frequency.

## How it works

Reads `~/.pi/agent/AGENTS.md` and `<cwd>/AGENTS.md`, parses headings annotated
with `@N`, and injects the rule text as a persistent system message between LLM
calls. Rules are selected with frequency-weighted probability and a cooldown to
avoid repetition.

Headings without `@N` are ignored. Any heading level works (`##`, `###`, etc.).
`@N` must appear at the end of the heading line (regex `\s*@(\d+)\s*$`). Parent
sections include their subsection headings and bodies.

```markdown
## Design review @5

Before any change, write a design brief and send to reviewer. If trivial, show
brief to user and request skip.

### What should be in the brief @3

...
```

- `@5` — relative frequency. Higher = selected more often.
- After selection, the rule's effective frequency is halved for the next pick
  (2^(-times_shown)).
- A rule is injected every N LLM calls. N defaults to 5, configurable in
  `.pi/mood.json` (see Config below).

## Status bar

```
mood: — · — · —                          (fresh start)
mood: 1.2kt · now · «Design review»      (just injected)
mood: 3.5kt · 4 ago · «Say it straight»  (between injections)
```

## Install

```bash
pi install npm:pi-mood
```

Or clone and install from local path:

```bash
git clone git@github.com:NikolayXHD/pi-mood.git
pi install ./pi-mood
```

## Config

Create `.pi/mood.json` in the project root:

```json
{ "injectionFrequency": 5 }
```

- `injectionFrequency` (number, default 5) — inject a rule every N LLM calls.
