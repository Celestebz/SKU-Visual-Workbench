# Issue 003: Build the Workbench Shell and Auth Setup State

Label: `ready-for-agent`

## Parent

`.scratch/frontend-workbench/prd.md`

## What to build

Build the first frontend shell for the local Web App. It should open as a workbench, call the local API, show whether Bailian is ready, and present detailed setup guidance when the user has not configured `bl auth`.

## Acceptance criteria

- [ ] The app opens in a browser from an npm script.
- [ ] The layout feels like a workbench, with clear areas for project input, asset planning, and output preview.
- [ ] The frontend calls the auth-status endpoint on load.
- [ ] Authenticated state clearly says real Bailian generation is available.
- [ ] Unauthenticated state shows detailed setup instructions without asking the user to paste an API key into the app.
- [ ] The UI makes it clear that GitHub upload is safe because credentials are not stored in the repo.

## Blocked by

- Issue 002
