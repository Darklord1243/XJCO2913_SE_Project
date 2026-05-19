# Contributing

## Commit Messages (Conventional Commits)
This project **requires Conventional Commits** for every commit. (Enforced by project convention; no automated commit-lint hook is installed.)

Use this format:
- **type**: short, imperative summary (lowercase)

Examples:
- `feat: add login route`
- `fix: correct database query`
- `docs: update wiki`

Common types:
- `feat`, `fix`, `docs`, `chore`, `refactor`, `test`

## Formatting
Before committing, you must run:

```bash
npm run format
```