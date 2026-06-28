# Issue 006: Generate Images for Selected Asset Prompts

Label: `ready-for-agent`

## Parent

`.scratch/frontend-workbench/prd.md`

## What to build

Add real Bailian image generation for selected asset prompts. The user should choose one or more prepared prompt cards, generate images, watch progress, see errors, and review generated candidates in a gallery.

Use `.scratch/frontend-workbench/interface-contract.md` for selected generation, job status, image metadata, and adopted-image endpoint shapes.

## Acceptance criteria

- [ ] The user can select which asset prompts to generate.
- [ ] The app calls the local API to generate images through the shared workflow and local `bl auth`.
- [ ] The UI shows generation progress per selected asset.
- [ ] Generation progress is represented through job status data compatible with the shared contract.
- [ ] Generation errors are displayed with useful retry guidance.
- [ ] Generated images appear under the correct asset card.
- [ ] The user can mark one generated image as adopted for an asset.
- [ ] Generated image metadata is saved in the local project.

## Blocked by

- Issue 005
