# Workflow

## Setup

```bash
npm install
```

Installs dev dependencies (typescript, eslint, @types/node, pi SDK).

## Testing

```bash
npm test
```

Runs `tests/` via `node --test`.

## Linting

```bash
npm run lint
```

## Local install

```bash
pi install .
```

Installs the extension from the current directory. Restart pi or /reload to
pick up changes.
