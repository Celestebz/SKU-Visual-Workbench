# Issue 007: Generate Copy, Quality Report, and Exportable Markdown

Label: `ready-for-agent`

## Parent

`.scratch/frontend-workbench/prd.md`

## What to build

Complete the production loop by generating Instagram caption copy, hashtags, alt text, publishing tips, a quality report, and exportable markdown for the selected project outputs.

Use `.scratch/frontend-workbench/interface-contract.md` for copy, quality report, and export endpoint shapes.

## Acceptance criteria

- [ ] The user can generate social copy for the current SKU project.
- [ ] The user can generate a quality report that scores asset readiness and gives retry guidance.
- [ ] The quality report references the asset types and adopted/generated images where available.
- [ ] The app displays caption, hashtags, alt text, publishing tips, and quality notes in the workbench.
- [ ] The project can export markdown equivalent to `showcase.md`, `social-copy.md`, `quality-report.md`, and `prompts.md`.
- [ ] Exported files are saved predictably under the project output directory.

## Blocked by

- Issue 006
