# ADR 0001: Local Web Workbench With Shared Workflow Module

## Status

Accepted

## Context

The project started as a Node CLI that generates overseas social media visual packs through Alibaba Cloud Bailian CLI/API calls. The next product step is a frontend for daily work, not just Workshop demonstration.

The user wants a workbench-style local Web App that can call Bailian for real image generation while keeping API keys out of GitHub.

## Decision

Build a local Web App backed by a local API service. Refactor the current CLI workflow into a shared workflow module used by both the CLI and Web App service.

Use the user's existing local `bl auth` setup for Bailian access. Do not store API keys in frontend code, repo config, or project history.

## Consequences

- CLI and Web App share the same business workflow and prompt logic.
- The app can show progress, errors, and local history more cleanly than shelling out blindly from the UI.
- Each new computer must run `bl auth login` independently.
- GitHub upload is safe by default as long as outputs, project history, and env files remain ignored.
