import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

export const PROJECTS_DIR = path.join(ROOT, "projects");

export function slugify(value) {
  return String(value || "sku-project")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "sku-project";
}

export function createProjectId(name, now = new Date()) {
  const timestamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "z")
    .replace("T", "-");
  return `${slugify(name)}-${timestamp}`;
}

export function createEmptyProject(input, now = new Date()) {
  const createdAt = now.toISOString();
  const name = input.name?.trim() || `${input.productName || "Untitled SKU"} Instagram Pack`;
  const id = createProjectId(name, now);

  return {
    id,
    name,
    status: "draft",
    createdAt,
    updatedAt: createdAt,
    input: {
      productName: input.productName?.trim() || "",
      platform: input.platform || "instagram",
      market: input.market?.trim() || "",
      audience: input.audience?.trim() || "",
      visualStyle: input.visualStyle?.trim() || "",
      notes: input.notes?.trim() || "",
      referenceImage: input.referenceImagePath || ""
    },
    brief: null,
    assets: [],
    copy: null,
    quality: null,
    exports: []
  };
}

export async function ensureProjectsDir() {
  await mkdir(PROJECTS_DIR, { recursive: true });
}

export function getProjectDir(projectId) {
  return path.join(PROJECTS_DIR, projectId);
}

export function getProjectFile(projectId) {
  return path.join(getProjectDir(projectId), "project.json");
}

export async function saveProject(project) {
  await mkdir(getProjectDir(project.id), { recursive: true });
  await writeFile(getProjectFile(project.id), `${JSON.stringify(project, null, 2)}\n`, "utf8");
  return project;
}

export async function createProject(input) {
  await ensureProjectsDir();
  const project = createEmptyProject(input);
  await maybeCopyReferenceImage(project, input.referenceImagePath);
  return saveProject(project);
}

export async function maybeCopyReferenceImage(project, referenceImagePath) {
  if (!referenceImagePath) return;
  const ext = path.extname(referenceImagePath) || ".image";
  const referenceDir = path.join(getProjectDir(project.id), "reference");
  const target = path.join(referenceDir, `source-image${ext}`);

  await mkdir(referenceDir, { recursive: true });
  try {
    await copyFile(referenceImagePath, target);
    project.input.referenceImage = path.relative(getProjectDir(project.id), target);
  } catch {
    project.input.referenceImage = referenceImagePath;
  }
}

export async function readProject(projectId) {
  const raw = await readFile(getProjectFile(projectId), "utf8");
  return JSON.parse(raw);
}

export async function listProjects() {
  await ensureProjectsDir();
  const entries = await readdir(PROJECTS_DIR, { withFileTypes: true });
  const projects = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const project = await readProject(entry.name);
      projects.push(toProjectSummary(project));
    } catch {
      // Ignore malformed local project folders so one bad file does not break history.
    }
  }

  return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function toProjectSummary(project) {
  const adopted = project.assets
    ?.flatMap((asset) => asset.images || [])
    ?.find((image) => image.adopted);
  const firstImage = project.assets
    ?.flatMap((asset) => asset.images || [])
    ?.find((image) => image.file);

  return {
    id: project.id,
    name: project.name,
    productName: project.input?.productName || "",
    platform: project.input?.platform || "instagram",
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    thumbnail: adopted?.file || firstImage?.file || null
  };
}

export async function updateProject(projectId, patch) {
  const project = await readProject(projectId);
  if (patch.input) {
    project.input = {
      ...project.input,
      ...patch.input
    };
  }
  if (Array.isArray(patch.assets)) {
    project.assets = mergeAssets(project.assets || [], patch.assets);
  }
  project.updatedAt = new Date().toISOString();
  await saveProject(project);
  return project;
}

export async function savePromptPlan(projectId, { brief, assets }) {
  const project = await readProject(projectId);
  project.brief = brief;
  project.assets = assets;
  project.status = "planned";
  project.updatedAt = new Date().toISOString();
  await saveProject(project);
  return project;
}

export async function appendGeneratedImages(projectId, generatedGroups) {
  const project = await readProject(projectId);
  const now = new Date().toISOString();
  const byId = new Map((project.assets || []).map((asset) => [asset.id, asset]));

  for (const group of generatedGroups) {
    const asset = byId.get(group.id);
    if (!asset) continue;
    const existing = asset.images || [];
    const additions = (group.files || []).map((file) => ({
      file: file.startsWith("images/") ? file : `images/${file}`,
      createdAt: now,
      adopted: false
    }));
    asset.images = [...existing, ...additions];
  }

  project.assets = [...byId.values()];
  project.updatedAt = now;
  await saveProject(project);
  return project;
}

export async function adoptImage(projectId, assetId, file) {
  const project = await readProject(projectId);
  const asset = project.assets?.find((item) => item.id === assetId);
  if (!asset) throw new Error("Asset not found");

  asset.images = (asset.images || []).map((image) => ({
    ...image,
    adopted: image.file === file
  }));
  project.updatedAt = new Date().toISOString();
  await saveProject(project);
  return { assetId, adoptedImage: file };
}

export async function saveCopy(projectId, copy) {
  const project = await readProject(projectId);
  project.copy = copy;
  project.updatedAt = new Date().toISOString();
  await saveProject(project);
  return project;
}

export async function saveQuality(projectId, quality) {
  const project = await readProject(projectId);
  project.quality = quality;
  project.updatedAt = new Date().toISOString();
  await saveProject(project);
  return project;
}

export async function saveExports(projectId, exports) {
  const project = await readProject(projectId);
  project.exports = exports;
  project.updatedAt = new Date().toISOString();
  await saveProject(project);
  return project;
}

export function mergeAssets(existing, patches) {
  const byId = new Map(existing.map((asset) => [asset.id, asset]));
  for (const patch of patches) {
    const current = byId.get(patch.id) || { id: patch.id };
    byId.set(patch.id, {
      ...current,
      ...patch,
      prompt: patch.prompt ?? current.prompt,
      negativePrompt: patch.negativePrompt ?? current.negativePrompt,
      layers: {
        ...(current.layers || {}),
        ...(patch.layers || {})
      }
    });
  }
  return [...byId.values()];
}
