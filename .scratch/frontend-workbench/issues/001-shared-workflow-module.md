# Issue 001: Refactor the CLI Workflow Into a Shared Workflow Module

Label: `ready-for-agent`

Status: implemented

## Parent

`.scratch/frontend-workbench/prd.md`

## What to build

Create a shared workflow module that contains the current SKU visual production logic, and update the existing CLI script to call that module instead of owning all workflow behavior directly. This makes the upcoming local Web App and the CLI use the same product understanding, prompt generation, image generation, copy generation, quality report, and output-writing behavior.

## Acceptance criteria

- [x] The existing CLI commands still work for mock and real generation.
- [x] Shared workflow functions can be called without going through CLI argument parsing.
- [x] The shared module exposes operations for auth-independent prompt planning, image generation, copy generation, quality reporting, and output persistence.
- [x] Existing generated file shapes remain compatible: `brief.json`, `prompts.md`, `social-copy.md`, `quality-report.md`, `showcase.md`, and `images/`.
- [x] `npm run check`, `npm run demo`, and `npm run samples` still pass.

## Blocked by

None - can start immediately.
