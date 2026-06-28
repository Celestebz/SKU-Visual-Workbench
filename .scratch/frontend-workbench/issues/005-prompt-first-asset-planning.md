# Issue 005: Generate and Edit Instagram SKU Asset Prompt Plans

Label: `ready-for-agent`

Status: implemented

## Parent

`.scratch/frontend-workbench/prd.md`

## What to build

Add the prompt-first planning flow. For a saved SKU project, the user should generate Instagram prompt plans for the four asset types: main product image, lifestyle scene image, selling point image, and ad test creative. The user should be able to edit each layer before generating images.

Use `.scratch/frontend-workbench/interface-contract.md` for asset IDs, layer names, prompt plan endpoint shape, and frontend state mapping.

## Acceptance criteria

- [x] The user can trigger prompt planning without generating images.
- [x] The workflow creates four Instagram asset cards: main, lifestyle, selling-point, and ad-test.
- [x] Each asset card shows task layer, fact layer, scene layer, style layer, conversion layer, final prompt, and negative prompt.
- [x] Layer field names match the shared contract: `task`, `fact`, `scene`, `style`, and `conversion`.
- [x] Each structured prompt layer is editable in the UI.
- [x] Saving the project persists edited prompt layers.
- [x] The final prompt updates from the edited layers or clearly shows what will be sent to image generation.
- [x] The flow works in mock mode for development without spending quota.

## Blocked by

- Issue 004
