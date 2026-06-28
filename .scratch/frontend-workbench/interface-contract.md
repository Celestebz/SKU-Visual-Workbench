# Interface Contract: Local Instagram SKU Visual Workbench

## Overview

The app has three layers:

- Frontend workbench: browser UI for project input, prompt editing, image generation, gallery, quality report, and export.
- Local API service: Node service that exposes HTTP endpoints and calls the shared workflow module.
- Local project store: gitignored files on disk, used as the first-version persistence layer.

No API key is sent to or stored by the frontend. Bailian access uses the local machine's `bl auth` configuration.

## Local API

Base URL: `http://localhost:<port>/api`

### `GET /health`

Returns service availability.

Response:

```json
{
  "ok": true,
  "version": "0.1.0"
}
```

### `GET /auth/status`

Checks local Bailian CLI authentication.

Response when ready:

```json
{
  "authenticated": true,
  "method": "bl-auth",
  "masked": "sk-...xxxx",
  "canGenerate": true,
  "setupSteps": []
}
```

Response when not ready:

```json
{
  "authenticated": false,
  "method": "bl-auth",
  "masked": null,
  "canGenerate": false,
  "setupSteps": [
    "Install or verify the Bailian CLI: bl --version",
    "Run: bl auth login",
    "Paste your own Bailian API Key when prompted",
    "Verify: bl auth status"
  ]
}
```

### `GET /projects`

Lists local SKU projects.

Response:

```json
{
  "projects": [
    {
      "id": "msc12-elite-2026-06-28-153000",
      "name": "MSC12 Elite Instagram Pack",
      "productName": "MSC12 Elite Electric Guitar",
      "platform": "instagram",
      "createdAt": "2026-06-28T15:30:00.000Z",
      "updatedAt": "2026-06-28T15:45:00.000Z",
      "thumbnail": "/api/projects/msc12-elite-2026-06-28-153000/files/images/instagram-portrait-lifestyle.png"
    }
  ]
}
```

### `POST /projects`

Creates a local SKU project.

Request:

```json
{
  "name": "MSC12 Elite Instagram Pack",
  "productName": "MSC12 Elite Electric Guitar",
  "platform": "instagram",
  "market": "US/EU",
  "audience": "beginner electric guitar players",
  "visualStyle": "premium, fresh, lifestyle, beginner-friendly",
  "notes": "Pink-to-black gradient, black pickguard, silver hardware.",
  "referenceImagePath": "/Users/celeste/Pictures/images/MSC12 Elite.png"
}
```

Response:

```json
{
  "project": {
    "id": "msc12-elite-2026-06-28-153000",
    "status": "draft"
  }
}
```

### `GET /projects/:projectId`

Returns full project state.

Response:

```json
{
  "project": {
    "id": "msc12-elite-2026-06-28-153000",
    "status": "draft",
    "input": {},
    "brief": null,
    "assets": [],
    "copy": null,
    "quality": null,
    "exports": []
  }
}
```

### `PATCH /projects/:projectId`

Updates project input fields or user-edited prompt layers.

Request:

```json
{
  "input": {
    "audience": "US/EU beginner electric guitar players"
  },
  "assets": [
    {
      "id": "instagram-portrait-lifestyle",
      "layers": {
        "scene": "Bedroom-studio practice corner with laptop lesson, notebook, headphones, and soft morning window light."
      }
    }
  ]
}
```

Response:

```json
{
  "project": {
    "id": "msc12-elite-2026-06-28-153000",
    "updatedAt": "2026-06-28T15:46:00.000Z"
  }
}
```

### `POST /projects/:projectId/plan-prompts`

Generates brief and structured prompt plans without image generation.

Request:

```json
{
  "assetTypes": ["main", "lifestyle", "selling-point", "ad-test"],
  "variant": "instagram-portrait",
  "mock": false
}
```

Response:

```json
{
  "brief": {
    "campaign_name": "First Electric Guitar Instagram Launch",
    "product": "MSC12 Elite Electric Guitar",
    "audience": "beginner electric guitar players"
  },
  "assets": [
    {
      "id": "instagram-portrait-lifestyle",
      "assetType": "lifestyle",
      "variant": "instagram-portrait",
      "label": "Instagram Portrait / Lifestyle Scene Image",
      "size": "1080*1350",
      "layers": {
        "task": "platform-native lifestyle use scene",
        "fact": "Preserve the reference guitar exactly...",
        "scene": "Bedroom-studio practice moment...",
        "style": "Premium, fresh, approachable...",
        "conversion": "make the shopper imagine the product fitting naturally into their daily life"
      },
      "prompt": "TASK LAYER: ...",
      "negativePrompt": "distorted guitar, changed guitar color..."
    }
  ]
}
```

### `POST /projects/:projectId/generate-images`

Generates images only for selected asset prompts.

Request:

```json
{
  "assetIds": ["instagram-portrait-lifestyle"],
  "n": 1,
  "mock": false
}
```

Response:

```json
{
  "jobId": "job-2026-06-28-154700",
  "status": "running"
}
```

### `GET /jobs/:jobId`

Returns current generation status.

Response:

```json
{
  "jobId": "job-2026-06-28-154700",
  "status": "completed",
  "progress": [
    {
      "assetId": "instagram-portrait-lifestyle",
      "status": "completed",
      "files": ["images/instagram-portrait-lifestyle.png"]
    }
  ],
  "error": null
}
```

### `POST /projects/:projectId/adopt-image`

Marks one generated image as selected for an asset.

Request:

```json
{
  "assetId": "instagram-portrait-lifestyle",
  "file": "images/instagram-portrait-lifestyle.png"
}
```

Response:

```json
{
  "assetId": "instagram-portrait-lifestyle",
  "adoptedImage": "images/instagram-portrait-lifestyle.png"
}
```

### `POST /projects/:projectId/generate-copy`

Generates caption, hashtags, alt text, and publishing tips from current project state.

Response:

```json
{
  "copy": {
    "captions": [{ "platform": "Instagram", "caption": "..." }],
    "hashtags": ["#BeginnerGuitar"],
    "alt_text": "...",
    "publishing_tips": ["..."]
  }
}
```

### `POST /projects/:projectId/quality-report`

Generates quality scoring and retry guidance.

Response:

```json
{
  "quality": {
    "overall_score": 88,
    "best_asset_id": "instagram-portrait-lifestyle",
    "asset_reviews": [
      {
        "id": "instagram-portrait-lifestyle",
        "score": 91,
        "publish_readiness": "ready",
        "strengths": ["..."],
        "risks": ["..."],
        "retry_instruction": "..."
      }
    ]
  }
}
```

### `POST /projects/:projectId/export`

Writes export markdown files for the current project.

Response:

```json
{
  "exports": [
    "prompts.md",
    "social-copy.md",
    "quality-report.md",
    "showcase.md"
  ]
}
```

## Local Project Store

Default directory: `projects/`

This directory must be gitignored.

Project layout:

```text
projects/
  <projectId>/
    project.json
    reference/
      source-image.webp
    images/
      instagram-portrait-lifestyle.png
    exports/
      prompts.md
      social-copy.md
      quality-report.md
      showcase.md
```

### `project.json`

```json
{
  "id": "msc12-elite-2026-06-28-153000",
  "name": "MSC12 Elite Instagram Pack",
  "status": "draft",
  "createdAt": "2026-06-28T15:30:00.000Z",
  "updatedAt": "2026-06-28T15:45:00.000Z",
  "input": {
    "productName": "MSC12 Elite Electric Guitar",
    "platform": "instagram",
    "market": "US/EU",
    "audience": "beginner electric guitar players",
    "visualStyle": "premium, fresh, lifestyle, beginner-friendly",
    "notes": "Pink-to-black gradient, black pickguard, silver hardware.",
    "referenceImage": "reference/source-image.webp"
  },
  "brief": {},
  "assets": [
    {
      "id": "instagram-portrait-lifestyle",
      "assetType": "lifestyle",
      "variant": "instagram-portrait",
      "size": "1080*1350",
      "layers": {
        "task": "",
        "fact": "",
        "scene": "",
        "style": "",
        "conversion": ""
      },
      "prompt": "",
      "negativePrompt": "",
      "images": [
        {
          "file": "images/instagram-portrait-lifestyle.png",
          "createdAt": "2026-06-28T15:47:00.000Z",
          "adopted": true
        }
      ]
    }
  ],
  "copy": null,
  "quality": null,
  "exports": []
}
```

## Frontend State Mapping

- Project list reads `GET /projects`.
- Active project reads `GET /projects/:projectId`.
- Product input form writes `POST /projects` or `PATCH /projects/:projectId`.
- Prompt plan button calls `POST /projects/:projectId/plan-prompts`.
- Layer editors write `PATCH /projects/:projectId`.
- Generate selected button calls `POST /projects/:projectId/generate-images`.
- Progress panel polls `GET /jobs/:jobId`.
- Image gallery reads active project assets and files through project state.
- Adopt button calls `POST /projects/:projectId/adopt-image`.
- Copy, quality, and export buttons call their corresponding project endpoints.

## Error Shape

All API errors should use:

```json
{
  "error": {
    "code": "AUTH_NOT_CONFIGURED",
    "message": "Bailian CLI is not authenticated.",
    "action": "Run bl auth login, then retry."
  }
}
```

Common codes:

- `AUTH_NOT_CONFIGURED`
- `PROJECT_NOT_FOUND`
- `INVALID_PROJECT_INPUT`
- `PROMPT_PLAN_FAILED`
- `IMAGE_GENERATION_FAILED`
- `EXPORT_FAILED`
