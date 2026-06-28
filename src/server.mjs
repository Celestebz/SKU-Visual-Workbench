import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createProject,
  listProjects,
  readProject,
  savePromptPlan,
  updateProject
} from "./projects.mjs";
import {
  ASSET_TYPES,
  PLATFORM_VARIANTS,
  generateBrief,
  generatePrompts,
  run,
  selectAssetTypes,
  selectPlatformVariants
} from "./workflow.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");

export const DEFAULT_PORT = 4173;

export const SETUP_STEPS = [
  "Install or verify the Bailian CLI: bl --version",
  "Run: bl auth login",
  "Paste your own Bailian API Key when prompted",
  "Verify: bl auth status"
];

export function createApiError(code, message, action) {
  return {
    error: {
      code,
      message,
      action
    }
  };
}

export async function getPackageVersion() {
  try {
    const raw = await readFile(path.join(ROOT, "package.json"), "utf8");
    return JSON.parse(raw).version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export async function getAuthStatus() {
  try {
    const { stdout } = await run("bl", ["auth", "status"]);
    const status = JSON.parse(stdout);
    const masked = status?.api_key?.masked || status?.dashscope_commands?.masked || null;
    const authenticated = Boolean(status?.authenticated && status?.dashscope_commands?.method);

    return {
      authenticated,
      method: "bl-auth",
      masked: authenticated ? masked : null,
      canGenerate: authenticated,
      setupSteps: authenticated ? [] : SETUP_STEPS
    };
  } catch {
    return {
      authenticated: false,
      method: "bl-auth",
      masked: null,
      canGenerate: false,
      setupSteps: SETUP_STEPS
    };
  }
}

export async function routeRequest(req) {
  const url = new URL(req.url || "/", "http://localhost");

  if (req.method === "GET" && url.pathname === "/api/health") {
    return jsonResponse(200, {
      ok: true,
      version: await getPackageVersion()
    });
  }

  if (req.method === "GET" && url.pathname === "/api/auth/status") {
    return jsonResponse(200, await getAuthStatus());
  }

  if (req.method === "GET" && url.pathname === "/api/projects") {
    return jsonResponse(200, { projects: await listProjects() });
  }

  if (req.method === "POST" && url.pathname === "/api/projects") {
    const input = await readJsonBody(req);
    const validation = validateProjectInput(input);
    if (validation) return jsonResponse(400, validation);

    const project = await createProject(input);
    return jsonResponse(201, {
      project: {
        id: project.id,
        status: project.status
      }
    });
  }

  const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (projectMatch && req.method === "GET") {
    try {
      return jsonResponse(200, { project: await readProject(projectMatch[1]) });
    } catch {
      return jsonResponse(404, createApiError("PROJECT_NOT_FOUND", "Project not found.", "Choose another project or create a new one."));
    }
  }

  if (projectMatch && req.method === "PATCH") {
    try {
      const project = await updateProject(projectMatch[1], await readJsonBody(req));
      return jsonResponse(200, {
        project: {
          id: project.id,
          updatedAt: project.updatedAt
        }
      });
    } catch {
      return jsonResponse(404, createApiError("PROJECT_NOT_FOUND", "Project not found.", "Choose another project or create a new one."));
    }
  }

  const planPromptsMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/plan-prompts$/);
  if (planPromptsMatch && req.method === "POST") {
    try {
      const project = await readProject(planPromptsMatch[1]);
      const body = await readJsonBody(req);
      const plan = await planProjectPrompts(project, body);
      await savePromptPlan(project.id, plan);
      return jsonResponse(200, plan);
    } catch (error) {
      if (error.code === "ENOENT") {
        return jsonResponse(404, createApiError("PROJECT_NOT_FOUND", "Project not found.", "Choose another project or create a new one."));
      }
      return jsonResponse(500, createApiError("PROMPT_PLAN_FAILED", "Prompt planning failed.", error.message));
    }
  }

  if (url.pathname.startsWith("/api/")) {
    return jsonResponse(
      404,
      createApiError("NOT_FOUND", `No route for ${req.method} ${url.pathname}`, "Check the API path and method.")
    );
  }

  if (req.method === "GET" || req.method === "HEAD") {
    return serveStatic(url.pathname);
  }

  return jsonResponse(404, createApiError("NOT_FOUND", `No route for ${req.method} ${url.pathname}`, "Check the path and method."));
}

export async function planProjectPrompts(project, body = {}) {
  const variantId = body.variant || "instagram-portrait";
  const assetTypeIds = Array.isArray(body.assetTypes) && body.assetTypes.length
    ? body.assetTypes.join(",")
    : "main,lifestyle,selling-point,ad-test";
  const mock = body.mock ?? true;
  const briefText = buildProjectBriefText(project);
  const options = {
    brief: briefText,
    outDir: "",
    textModel: "qwen-plus",
    imageModel: "qwen-image-2.0",
    premiumImageModel: "qwen-image-max",
    referenceImage: project.input?.referenceImage || "",
    variants: variantId,
    assetTypes: assetTypeIds,
    skuPack: false,
    usePremium: false,
    mock,
    skipImages: true,
    n: "1",
    platformVariants: selectPlatformVariants(variantId),
    assetTypeVariants: selectAssetTypes(assetTypeIds, false)
  };

  const brief = await generateBrief(options);
  const prompts = await generatePrompts(options, brief);
  const assets = prompts.variants.map(promptVariantToAsset);

  return { brief, assets };
}

export function buildProjectBriefText(project) {
  const input = project.input || {};
  return [
    `Product: ${input.productName}`,
    `Platform: ${input.platform || "instagram"}`,
    `Market: ${input.market}`,
    `Audience: ${input.audience}`,
    `Visual style: ${input.visualStyle}`,
    `Notes: ${input.notes}`,
    "Generate an Instagram 4:5 SKU visual pack with main image, lifestyle scene image, selling point image, and ad test creative."
  ].filter((line) => !line.endsWith(": ") && !line.endsWith(":")).join("\n");
}

export function promptVariantToAsset(variant) {
  return {
    id: variant.id,
    assetType: variant.asset_type,
    variant: resolvePlatformVariantId(variant),
    label: variant.label,
    size: variant.size,
    layers: {
      task: variant.task_layer || "",
      fact: variant.fact_layer || "",
      scene: variant.scene_layer || "",
      style: variant.style_layer || "",
      conversion: variant.conversion_layer || ""
    },
    prompt: variant.prompt || "",
    negativePrompt: variant.negative_prompt || "",
    images: []
  };
}

function resolvePlatformVariantId(variant) {
  return PLATFORM_VARIANTS.find((item) => item.size === variant.size && variant.id?.startsWith(item.id))?.id || "instagram-portrait";
}

export async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

export function validateProjectInput(input) {
  if (!input || typeof input !== "object") {
    return createApiError("INVALID_PROJECT_INPUT", "Project input must be a JSON object.", "Send productName and project fields.");
  }
  if (!input.productName?.trim()) {
    return createApiError("INVALID_PROJECT_INPUT", "Product name is required.", "Enter a product name before creating a project.");
  }
  return null;
}

export function jsonResponse(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "http://localhost:5173",
      "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
      "access-control-allow-headers": "content-type",
      ...headers
    },
    body: JSON.stringify(body, null, 2)
  };
}

export async function serveStatic(pathname) {
  const filePath = resolvePublicPath(pathname);
  if (!filePath) {
    return jsonResponse(404, createApiError("NOT_FOUND", "Static asset not found.", "Open / to load the workbench."));
  }

  try {
    const body = await readFile(filePath);
    return {
      statusCode: 200,
      headers: {
        "content-type": getContentType(filePath)
      },
      body
    };
  } catch {
    return jsonResponse(404, createApiError("NOT_FOUND", "Static asset not found.", "Open / to load the workbench."));
  }
}

export function resolvePublicPath(pathname) {
  const routePath = pathname === "/" ? "/index.html" : pathname;
  const decoded = decodeURIComponent(routePath);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, normalized);
  const relative = path.relative(PUBLIC_DIR, filePath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return filePath;
}

export function getContentType(filePath) {
  const ext = path.extname(filePath);
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

export function createServer() {
  return http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      const response = jsonResponse(204, {});
      writeResponse(res, response);
      return;
    }

    try {
      const response = await routeRequest(req);
      writeResponse(res, response);
    } catch (error) {
      const response = jsonResponse(
        500,
        createApiError("INTERNAL_ERROR", "The local API service failed unexpectedly.", error.message)
      );
      writeResponse(res, response);
    }
  });
}

export function writeResponse(res, response) {
  res.writeHead(response.statusCode, response.headers);
  res.end(response.statusCode === 204 || res.req?.method === "HEAD" ? "" : response.body);
}

export function startServer({ port = DEFAULT_PORT, host = "127.0.0.1" } = {}) {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve({ server, port, host });
    });
  });
}
