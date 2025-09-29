# Repository Guidelines

## Project Structure & Module Organization
index.js is the single entry point that sets up the Discord client, schedules refresh logic, and reads configuration. Centralize new functionality in helpers exported from this file to keep `npm start` stable. Reference `config-example.yml` when introducing new options, and mirror documentation updates in `README.md`. Issue templates live under `.github/ISSUE_TEMPLATE` and should stay current with supported workflows.

## Build, Test, and Development Commands
- `npm install`: Fetch dependencies before first run or when `package.json` changes.
- `npm start`: Launch the bot with the current configuration and process environment.
- `node index.js`: Useful for quick local debugging without npm lifecycle hooks.
- `npm test`: Placeholder today; replace with your test runner as automated coverage lands.

## Coding Style & Naming Conventions
Follow the existing CommonJS style with two-space indentation, semicolons, and single-quoted strings. Prefer `const` by default and `let` only when reassignment is required. Name variables and helper functions in camelCase, and keep exported utilities narrowly scoped. When adding significant logic, document intent with concise comments and update any related configuration keys in kebab-case to match the current config schema.

## Testing Guidelines
No automated tests ship yet, so new features must include either unit or integration coverage before merging. Set up a Node-based runner (Jest or Vitest are typical) and wire it to `npm test`. Place specs alongside the code in a `__tests__` directory or use `.test.js` suffixes. Capture external calls with mocks so contributors can run the suite offline, and document manual Discord or Minecraft validation steps in the pull request.

## Commit & Pull Request Guidelines
Recent history favors Conventional Commit prefixes such as `feat:` and `fix:`; continue that pattern and keep messages under 72 characters on the subject line. Each pull request should describe motivation, summarize code changes, and list verification steps (`npm start`, manual guild checks, tests). Link related issues, attach screenshots for Discord UI changes, and request review before merging.

## Configuration & Secrets
Load secrets via environment variables where possible; `DISCORD_BOT_TOKEN` is required even when a local `config.yml` exists. Never commit real tokens or server IPs. If you add new settings, extend `config-example.yml` with safe defaults and explain migration steps in `README.md`. Document any required Discord intents or Minecraft server permissions so operators can reproduce your setup.
