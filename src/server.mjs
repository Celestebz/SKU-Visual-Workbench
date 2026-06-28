import http from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  adoptImage,
  appendGeneratedImages,
  createProject,
  getProjectDir,
  listProjects,
  readProject,
  saveCopy,
  saveExports,
  savePromptPlan,
  saveQuality,
  updateProject
} from "./projects.mjs";
import {
  ASSET_TYPES,
  PLATFORM_VARIANTS,
  generateBrief,
  generateCopy,
  generateImages,
  generatePrompts,
  generateQualityReport,
  renderCopyMarkdown,
  renderPromptsMarkdown,
  renderQualityMarkdown,
  renderShowcase,
  run,
  selectAssetTypes,
  selectPlatformVariants
} from "./workflow.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");

export const DEFAULT_PORT = 4173;
const jobs = new Map();

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

  const generateImagesMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/generate-images$/);
  if (generateImagesMatch && req.method === "POST") {
    try {
      const project = await readProject(generateImagesMatch[1]);
      const body = await readJsonBody(req);
      const job = startImageGenerationJob(project, body);
      return jsonResponse(202, { jobId: job.jobId, status: job.status });
    } catch (error) {
      if (error.code === "ENOENT") {
        return jsonResponse(404, createApiError("PROJECT_NOT_FOUND", "Project not found.", "Choose another project or create a new one."));
      }
      return jsonResponse(500, createApiError("IMAGE_GENERATION_FAILED", "Image generation could not start.", error.message));
    }
  }

  const adoptImageMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/adopt-image$/);
  if (adoptImageMatch && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      return jsonResponse(200, await adoptImage(adoptImageMatch[1], body.assetId, body.file));
    } catch (error) {
      return jsonResponse(404, createApiError("PROJECT_NOT_FOUND", "Could not adopt image.", error.message));
    }
  }

  const generateCopyMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/generate-copy$/);
  if (generateCopyMatch && req.method === "POST") {
    try {
      const project = await readProject(generateCopyMatch[1]);
      const copy = await generateProjectCopy(project, await readJsonBody(req));
      await saveCopy(project.id, copy);
      return jsonResponse(200, { copy });
    } catch (error) {
      return jsonResponse(500, createApiError("COPY_GENERATION_FAILED", "Copy generation failed.", error.message));
    }
  }

  const qualityMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/quality-report$/);
  if (qualityMatch && req.method === "POST") {
    try {
      const project = await readProject(qualityMatch[1]);
      const quality = await generateProjectQuality(project, await readJsonBody(req));
      await saveQuality(project.id, quality);
      return jsonResponse(200, { quality });
    } catch (error) {
      return jsonResponse(500, createApiError("QUALITY_REPORT_FAILED", "Quality report generation failed.", error.message));
    }
  }

  const exportMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/export$/);
  if (exportMatch && req.method === "POST") {
    try {
      const project = await readProject(exportMatch[1]);
      const exports = await exportProjectMarkdown(project);
      await saveExports(project.id, exports);
      return jsonResponse(200, { exports });
    } catch (error) {
      return jsonResponse(500, createApiError("EXPORT_FAILED", "Export failed.", error.message));
    }
  }

  const fileMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/files\/(.+)$/);
  if (fileMatch && (req.method === "GET" || req.method === "HEAD")) {
    return serveProjectFile(fileMatch[1], fileMatch[2]);
  }

  const jobMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)$/);
  if (jobMatch && req.method === "GET") {
    const job = jobs.get(jobMatch[1]);
    if (!job) return jsonResponse(404, createApiError("JOB_NOT_FOUND", "Generation job not found.", "Start a new generation job."));
    return jsonResponse(200, job);
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

export function startImageGenerationJob(project, body = {}) {
  const jobId = createJobId();
  const selectedAssetIds = Array.isArray(body.assetIds) && body.assetIds.length
    ? body.assetIds
    : (project.assets || []).map((asset) => asset.id);
  const selectedAssets = (project.assets || []).filter((asset) => selectedAssetIds.includes(asset.id));
  const job = {
    jobId,
    status: "running",
    progress: selectedAssets.map((asset) => ({ assetId: asset.id, status: "queued", files: [] })),
    error: null
  };
  jobs.set(jobId, job);

  runImageGenerationJob(project.id, selectedAssets, body, job).catch((error) => {
    job.status = "failed";
    job.error = {
      code: "IMAGE_GENERATION_FAILED",
      message: error.message,
      action: "Check the prompt, Bailian auth status, quota, and reference image path before retrying."
    };
  });

  return job;
}

export async function runImageGenerationJob(projectId, selectedAssets, body, job) {
  if (!selectedAssets.length) throw new Error("No asset prompts selected.");
  const project = await readProject(projectId);
  const variants = selectedAssets.map(assetToPromptVariant);
  const options = {
    outDir: getProjectDir(project.id),
    imageModel: body.imageModel || "qwen-image-2.0",
    referenceImage: resolveReferenceImage(project),
    mock: Boolean(body.mock),
    skipImages: false,
    n: String(body.n || 1)
  };

  for (const item of job.progress) item.status = "running";
  const generated = await generateImages(options, { variants });
  await appendGeneratedImages(project.id, generated);

  for (const item of job.progress) {
    const group = generated.find((result) => result.id === item.assetId);
    item.status = "completed";
    item.files = (group?.files || []).map((file) => file.startsWith("images/") ? file : `images/${file}`);
  }
  job.status = "completed";
}

export function createJobId(now = new Date()) {
  return `job-${now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "z").replace("T", "-")}-${Math.random().toString(36).slice(2, 8)}`;
}

export function assetToPromptVariant(asset) {
  return {
    id: asset.id,
    label: asset.label,
    size: asset.size,
    prompt: asset.prompt || composePromptFromLayers(asset.layers || {}),
    negative_prompt: asset.negativePrompt || ""
  };
}

export function composePromptFromLayers(layers) {
  return [
    `TASK LAYER: ${layers.task || ""}`,
    `FACT LAYER: ${layers.fact || ""}`,
    `SCENE LAYER: ${layers.scene || ""}`,
    `STYLE LAYER: ${layers.style || ""}`,
    `CONVERSION LAYER: ${layers.conversion || ""}`
  ].join("\n\n");
}

export function resolveReferenceImage(project) {
  const ref = project.input?.referenceImage || "";
  if (!ref) return "";
  return path.isAbsolute(ref) ? ref : path.join(getProjectDir(project.id), ref);
}

export async function generateProjectCopy(project, body = {}) {
  const mock = body.mock ?? true;
  const options = {
    textModel: "qwen-plus",
    mock
  };
  const prompts = projectToPrompts(project);
  return generateCopy(options, project.brief || {}, prompts);
}

export async function generateProjectQuality(project, body = {}) {
  const mock = body.mock ?? true;
  const options = {
    textModel: "qwen-plus",
    mock
  };
  const prompts = projectToPrompts(project);
  const images = (project.assets || []).map((asset) => ({
    id: asset.id,
    label: asset.label,
    files: (asset.images || []).map((image) => image.file)
  }));
  return generateQualityReport(options, project.brief || {}, prompts, images);
}

export function projectToPrompts(project) {
  return {
    variants: (project.assets || []).map((asset) => ({
      id: asset.id,
      label: asset.label,
      ratio: asset.variant,
      size: asset.size,
      asset_type: asset.assetType,
      task_layer: asset.layers?.task || "",
      fact_layer: asset.layers?.fact || "",
      scene_layer: asset.layers?.scene || "",
      style_layer: asset.layers?.style || "",
      conversion_layer: asset.layers?.conversion || "",
      prompt: asset.prompt || composePromptFromLayers(asset.layers || {}),
      negative_prompt: asset.negativePrompt || ""
    }))
  };
}

export async function exportProjectMarkdown(project) {
  const exportsDir = path.join(getProjectDir(project.id), "exports");
  await mkdir(exportsDir, { recursive: true });

  const prompts = projectToPrompts(project);
  const copy = project.copy || { captions: [], hashtags: [], alt_text: "", review_notes: [], publishing_tips: [] };
  const quality = project.quality || { overall_score: 0, best_asset_id: "", asset_reviews: [] };
  const images = (project.assets || []).map((asset) => ({
    id: asset.id,
    label: asset.label,
    files: (asset.images || []).map((image) => image.file)
  }));
  const options = {
    brief: buildProjectBriefText(project),
    textModel: "qwen-plus",
    imageModel: "qwen-image-2.0",
    assetTypeVariants: ASSET_TYPES
  };

  const files = [
    ["prompts.md", renderPromptsMarkdown(prompts)],
    ["social-copy.md", renderCopyMarkdown(copy)],
    ["quality-report.md", renderQualityMarkdown(quality)],
    ["showcase.md", renderShowcase({ options, brief: project.brief || {}, prompts, copy, images, quality })]
  ];

  for (const [filename, content] of files) {
    await writeFile(path.join(exportsDir, filename), content, "utf8");
  }

  return files.map(([filename]) => `exports/${filename}`);
}

export async function serveProjectFile(projectId, filePath) {
  const decoded = decodeURIComponent(filePath);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const absolute = path.join(getProjectDir(projectId), normalized);
  const relative = path.relative(getProjectDir(projectId), absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return jsonResponse(404, createApiError("NOT_FOUND", "Project file not found.", "Choose a file from the project output list."));
  }

  try {
    const body = await readFile(absolute);
    return {
      statusCode: 200,
      headers: { "content-type": getContentType(absolute) },
      body
    };
  } catch {
    return jsonResponse(404, createApiError("NOT_FOUND", "Project file not found.", "Choose a file from the project output list."));
  }
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
  if (ext === ".md") return "text/markdown; charset=utf-8";
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
