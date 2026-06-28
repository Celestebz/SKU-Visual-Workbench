# Issue 004: Create and Reopen Local SKU Projects

Label: `ready-for-agent`

## Parent

`.scratch/frontend-workbench/prd.md`

## What to build

Add local project history for SKU visual packs. The user should be able to create a project from product inputs and a reference image, save it locally, see it in a history list, and reopen it later.

Use `.scratch/frontend-workbench/interface-contract.md` for the project JSON shape, project list response, and local directory layout.

## Acceptance criteria

- [ ] The user can create a new project with product name, target market, audience, platform, visual style, and notes.
- [ ] The user can attach or reference a product image.
- [ ] The project is saved under a gitignored local project-history directory.
- [ ] Project persistence follows the documented `project.json` structure.
- [ ] The frontend shows a history list of saved projects.
- [ ] Reopening a project restores its product inputs and current workflow state.
- [ ] Private local outputs and project history are ignored by Git.

## Blocked by

- Issue 003
