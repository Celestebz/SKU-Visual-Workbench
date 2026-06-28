# PRD: Local Instagram SKU Visual Workbench

## Problem Statement

The user needs a practical frontend for daily cross-border ecommerce visual production. The current CLI can generate prompts, images, captions, and quality notes, but it is not ergonomic for repeated work: product inputs are command-line strings, prompts are hard to review before spending quota, generated assets are scattered in output folders, and local history is not visible as projects.

The user wants a workbench that lets them upload a product reference image, describe one SKU, generate structured prompt plans, edit those prompts by layer, selectively call Bailian to generate images, and save each SKU visual pack locally for later reuse.

## Solution

Build a local Web App workbench for one-person production use. The first version focuses on Instagram and four SKU asset types: main product image, lifestyle scene image, selling point image, and ad test creative.

The app should run locally in the browser, backed by a local Node API service. It should call the existing Bailian-powered workflow through a shared workflow module, using the user's existing `bl auth` configuration. It should not store API keys in the repo or frontend.

The workflow is prompt-first: the user enters product details and uploads a reference image, generates editable structured prompts, chooses which asset prompts to render, and then generates images. Each project is saved locally with product inputs, prompt layers, generated images, captions, quality reports, and exportable markdown.

## User Stories

1. As a cross-border ecommerce operator, I want to open a local visual workbench in my browser, so that I can work without memorizing CLI commands.
2. As a user, I want to create a new SKU project, so that each product's visual production work is organized separately.
3. As a user, I want to upload or select a product reference image, so that generated visuals preserve the real product.
4. As a user, I want to enter product name, market, audience, platform, visual style, and notes, so that the AI understands my business context.
5. As a user, I want the first version to focus on Instagram, so that the interface stays simple and useful.
6. As a user, I want the app to generate four asset plans for one SKU, so that I get a main image, lifestyle scene, selling point image, and ad test creative.
7. As a user, I want each asset plan to show task layer, fact layer, scene layer, style layer, and conversion layer, so that I can understand and edit the prompt strategy.
8. As a user, I want to edit each prompt layer before image generation, so that I can improve the scene and emotion without wasting quota.
9. As a user, I want to choose which asset prompts to generate, so that I only spend quota on images I actually want.
10. As a user, I want to see generation progress and errors in the UI, so that long-running Bailian calls are understandable.
11. As a user, I want the app to use my local `bl auth` setup, so that I do not paste API keys into the frontend.
12. As a user, I want a clear unauthenticated state with setup steps, so that I know how to configure a new computer.
13. As a user, I want generated images displayed in a gallery under each asset type, so that I can compare options.
14. As a user, I want to mark an image as selected or adopted, so that the final export knows which image I plan to use.
15. As a user, I want generated captions, hashtags, alt text, publishing tips, and quality notes, so that I can publish faster.
16. As a user, I want a local project history sidebar or list, so that I can reopen previous SKU visual packs.
17. As a user, I want all history saved locally, so that my work remains private and portable.
18. As a user, I want outputs organized predictably on disk, so that I can find images and markdown exports outside the app.
19. As a user, I want the app to be safe to upload to GitHub, so that no API key or private generated output is committed.
20. As a future maintainer, I want the CLI and Web App to share one workflow module, so that prompt logic does not drift.

## Implementation Decisions

- Build a local Web App with a frontend workbench and a local Node API service.
- Refactor the existing CLI workflow into a shared workflow module that exposes product brief generation, prompt generation, image generation, copy generation, quality report generation, and project persistence operations.
- Keep the existing CLI as a wrapper around the shared workflow module.
- Use local `bl auth` as the only first-version authentication path for Bailian. The frontend should never collect or store API keys.
- Add a startup/auth status endpoint that checks `bl auth status` and returns whether the app can generate real images.
- Use the API and local project-store contract in `.scratch/frontend-workbench/interface-contract.md` as the alignment source for frontend, backend, and persistence work.
- Show detailed setup instructions when unauthenticated: install `bl`, run `bl auth login`, paste the user's Bailian API key, then verify with `bl auth status`.
- Save projects locally under a gitignored project-history directory. Each project should include source inputs, reference image path or copied asset, structured prompts, generated image metadata, social copy, quality report, and export markdown.
- Use a prompt-first interaction model. Prompt generation and image generation are separate user actions.
- The first product surface is Instagram only, with a 4:5 portrait default and the four asset types listed above.
- The frontend should be a workbench: left input/setup panel, center asset/prompt editor, right preview/output panel or a responsive equivalent.
- Each asset card should expose editable task, fact, scene, style, and conversion layers plus generated final prompt and negative prompt.
- Image generation should run per selected asset prompt, not automatically for every asset.
- The app should support mock mode for development, but real Bailian generation is the primary product path.
- Repository hygiene must include ignoring local outputs, project history, `.env`, and any private credentials.

## Testing Decisions

- Test the highest practical seam: local API service behavior from request to saved project artifact, with Bailian calls mocked.
- Test shared workflow module behavior separately for prompt plan creation, project persistence, and auth-status parsing.
- Test frontend behavior through user-visible flows: unauthenticated setup state, new project creation, prompt generation, prompt editing, selected image generation, history reopen, and export display.
- Do not test implementation details of individual UI components where end-to-end or integration tests cover the behavior.
- Include a smoke test for the CLI wrapper to ensure it still calls the shared workflow.

## Out of Scope

- Cloud deployment, accounts, team collaboration, or remote database.
- Direct publishing to Instagram.
- API key input/storage inside the frontend.
- Amazon, TikTok Shop, independent site, and Facebook generation in the first version.
- Multi-language content generation beyond English Instagram copy.
- Advanced image editing tools such as masking, crop editor, or canvas compositing.

## Further Notes

The product should be positioned as a practical cross-border ecommerce visual production Agent, not a generic image generator. The first version should make the business chain visible: product input, SKU task planning, structured prompt editing, selected generation, quality review, and reusable local project history.
