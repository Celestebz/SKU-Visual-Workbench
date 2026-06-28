# Issue 002: Add Local API Service With Bailian Auth Status

Label: `ready-for-agent`

## Parent

`.scratch/frontend-workbench/prd.md`

## What to build

Add a local Node API service that the future frontend can call. The first vertical slice should expose app health and Bailian authentication status by checking the local `bl auth status`, and return setup guidance when the user is not authenticated.

Use `.scratch/frontend-workbench/interface-contract.md` for endpoint shapes and error format.

## Acceptance criteria

- [ ] A local API service can be started from an npm script.
- [ ] The service exposes a health endpoint.
- [ ] The service exposes an auth-status endpoint that reports whether `bl auth` is configured.
- [ ] API errors follow the shared error shape.
- [ ] When unauthenticated, the response includes actionable setup steps: install/verify `bl`, run `bl auth login`, paste the user's Bailian API key, and verify with `bl auth status`.
- [ ] No API key is accepted by or returned from the API.
- [ ] README documents the new local service and new-computer setup flow.

## Blocked by

- Issue 001
