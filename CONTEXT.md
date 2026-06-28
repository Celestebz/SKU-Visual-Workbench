# Project Context

## Product

The product is a local Web App workbench for cross-border ecommerce visual production. It helps a solo operator turn one SKU and a product reference image into Instagram-ready visual assets.

## Domain Language

- **SKU visual pack**: A set of visual assets for one product/SKU.
- **Asset type**: A business-oriented visual task such as main product image, lifestyle scene image, selling point image, or ad test creative.
- **Structured prompt**: A prompt split into editable layers.
- **Task layer**: The sales or content job the asset should perform.
- **Fact layer**: Product facts and fixed visual details that must not drift.
- **Scene layer**: Space, props, composition, lens, light, color, and human-use cues.
- **Style layer**: Mood, texture, realism, and platform-native aesthetic.
- **Conversion layer**: The shopper belief, feeling, or action the image should support.
- **Prompt-first workflow**: The user reviews and edits prompts before spending image generation quota.
- **Local project history**: Saved SKU projects stored on the user's machine, not in a cloud database.

## Current Decisions

- The first frontend should be a workbench-style local Web App, not a chat UI.
- The app should really call Bailian image generation through the local `bl` CLI/auth setup.
- API keys must not be stored in the repo or frontend. Each machine configures Bailian with `bl auth login`.
- If not logged in, the frontend should show detailed setup guidance and README should document the same flow.
- The first version covers Instagram only.
- The first version covers four asset types: main product image, lifestyle scene image, selling point image, and ad test creative.
- The workflow should generate structured prompts first, then let the user manually choose which prompts to turn into images.
- Structured prompts should be editable by layer.
- Projects should be saved locally for future reuse.
- The existing CLI workflow should be refactored into a shared workflow module used by both CLI and local API service.
