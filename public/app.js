const authCard = document.querySelector("#auth-card");
const authTitle = document.querySelector("#auth-title");
const authDetail = document.querySelector("#auth-detail");
const authGuidance = document.querySelector("#auth-guidance");
const projectForm = document.querySelector("#project-form");
const projectMessage = document.querySelector("#project-message");
const projectList = document.querySelector("#project-list");
const assetList = document.querySelector("#asset-list");
const planPromptsButton = document.querySelector("#plan-prompts");
let activeProject = null;

async function loadAuthStatus() {
  try {
    const response = await fetch("/api/auth/status");
    if (!response.ok) {
      throw new Error(`Auth check failed with HTTP ${response.status}`);
    }
    const status = await response.json();
    renderAuthStatus(status);
  } catch (error) {
    renderAuthError(error);
  }
}

function renderAuthStatus(status) {
  if (status.authenticated && status.canGenerate) {
    authCard.dataset.state = "ready";
    authTitle.textContent = "Bailian ready";
    authDetail.textContent = `Real image generation available via ${status.method}${status.masked ? ` (${status.masked})` : ""}.`;
    authGuidance.innerHTML = `
      <h3>Ready for real generation</h3>
      <p>This computer is logged in with local <code>bl auth</code>. The frontend does not store your full API Key.</p>
    `;
    return;
  }

  authCard.dataset.state = "missing";
  authTitle.textContent = "Bailian setup needed";
  authDetail.textContent = "Real image generation is disabled until local bl auth is configured.";
  authGuidance.innerHTML = `
    <h3>Set up Bailian on this computer</h3>
    <ol>
      ${status.setupSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
    </ol>
    <p>After setup, refresh this page. Do not paste your API Key into this app or commit it to GitHub.</p>
  `;
}

function renderAuthError(error) {
  authCard.dataset.state = "error";
  authTitle.textContent = "API offline";
  authDetail.textContent = "Start the local service with npm run app.";
  authGuidance.innerHTML = `
    <h3>Local API is unavailable</h3>
    <p>${escapeHtml(error.message)}</p>
    <p>Run <code>npm run app</code>, then reopen this page.</p>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loadAuthStatus();
loadProjects();

planPromptsButton.addEventListener("click", async () => {
  if (!activeProject) return;
  projectMessage.textContent = "Generating prompt plan...";

  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(activeProject.id)}/plan-prompts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        assetTypes: ["main", "lifestyle", "selling-point", "ad-test"],
        variant: "instagram-portrait",
        mock: true
      })
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message || "Prompt planning failed.");

    activeProject.brief = body.brief;
    activeProject.assets = body.assets;
    renderAssets(activeProject.assets);
    projectMessage.textContent = "Prompt plan generated. Edit layers, then save changes.";
    await loadProjects(activeProject.id);
  } catch (error) {
    projectMessage.textContent = error.message;
  }
});

projectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  projectMessage.textContent = "Saving project...";

  try {
    const payload = getProjectFormPayload();
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message || "Project save failed.");

    projectMessage.textContent = "Project saved locally.";
    await loadProjects(body.project.id);
    await loadProject(body.project.id);
  } catch (error) {
    projectMessage.textContent = error.message;
  }
});

function getProjectFormPayload() {
  const data = new FormData(projectForm);
  return {
    name: data.get("name"),
    productName: data.get("productName"),
    platform: "instagram",
    market: data.get("market"),
    audience: data.get("audience"),
    visualStyle: data.get("visualStyle"),
    notes: data.get("notes"),
    referenceImagePath: data.get("referenceImagePath")
  };
}

async function loadProjects(activeProjectId = null) {
  try {
    const response = await fetch("/api/projects");
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message || "Could not load projects.");
    renderProjects(body.projects, activeProjectId);
  } catch (error) {
    projectList.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
  }
}

function renderProjects(projects, activeProjectId) {
  if (!projects.length) {
    projectList.innerHTML = `<p class="empty-state">No local projects yet. Save this SKU to start history.</p>`;
    return;
  }

  projectList.innerHTML = projects
    .map((project) => {
      const activeClass = project.id === activeProjectId ? " is-active" : "";
      return `
        <button class="project-button${activeClass}" type="button" data-project-id="${escapeHtml(project.id)}">
          <strong>${escapeHtml(project.name)}</strong>
          <span>${escapeHtml(project.productName || "Untitled product")} · ${escapeHtml(project.platform)} · ${formatDate(project.updatedAt)}</span>
        </button>
      `;
    })
    .join("");

  projectList.querySelectorAll("[data-project-id]").forEach((button) => {
    button.addEventListener("click", () => loadProject(button.dataset.projectId));
  });
}

async function loadProject(projectId) {
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message || "Could not open project.");
    activeProject = body.project;
    fillProjectForm(body.project);
    renderAssets(body.project.assets || []);
    planPromptsButton.disabled = false;
    projectMessage.textContent = `Opened ${body.project.name}.`;
    await loadProjects(projectId);
  } catch (error) {
    projectMessage.textContent = error.message;
  }
}

function fillProjectForm(project) {
  setField("project-name", project.name);
  setField("product-name", project.input?.productName);
  setField("market", project.input?.market);
  setField("audience", project.input?.audience);
  setField("visual-style", project.input?.visualStyle);
  setField("reference-image-path", project.input?.referenceImage);
  setField("notes", project.input?.notes);
}

function setField(id, value) {
  const field = document.querySelector(`#${id}`);
  if (field) field.value = value || "";
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function renderAssets(assets) {
  if (!assets.length) {
    assetList.innerHTML = `
      <article class="asset-card">
        <span>Prompt plan</span>
        <h3>No generated prompt plan yet</h3>
        <p>Save or open a project, then generate the Instagram SKU prompt plan.</p>
      </article>
    `;
    return;
  }

  assetList.innerHTML = assets.map(renderAssetCard).join("");
  assetList.querySelectorAll("[data-save-asset]").forEach((button) => {
    button.addEventListener("click", () => saveAssetLayers(button.dataset.saveAsset));
  });
  assetList.querySelectorAll("[data-layer-input]").forEach((field) => {
    field.addEventListener("input", () => updatePromptPreview(field.closest(".asset-card")));
  });
}

function renderAssetCard(asset) {
  return `
    <article class="asset-card" data-asset-id="${escapeHtml(asset.id)}">
      <span>${escapeHtml(asset.assetType)}</span>
      <h3>${escapeHtml(asset.label)}</h3>
      <p>${escapeHtml(asset.size)} · ${escapeHtml(asset.variant)}</p>
      <div class="layer-grid">
        ${renderLayerField(asset, "task", "Task layer")}
        ${renderLayerField(asset, "fact", "Fact layer")}
        ${renderLayerField(asset, "scene", "Scene layer")}
        ${renderLayerField(asset, "style", "Style layer")}
        ${renderLayerField(asset, "conversion", "Conversion layer")}
        ${renderNegativeField(asset)}
      </div>
      <label class="prompt-preview">
        Final prompt
        <textarea data-prompt readonly rows="6">${escapeHtml(composePrompt(asset))}</textarea>
      </label>
      <button class="secondary-button" data-save-asset="${escapeHtml(asset.id)}" type="button">Save prompt layers</button>
    </article>
  `;
}

function renderLayerField(asset, key, label) {
  return `
    <label>
      ${label}
      <textarea data-layer-input="${key}" rows="4">${escapeHtml(asset.layers?.[key] || "")}</textarea>
    </label>
  `;
}

function renderNegativeField(asset) {
  return `
    <label>
      Negative prompt
      <textarea data-negative-prompt rows="4">${escapeHtml(asset.negativePrompt || "")}</textarea>
    </label>
  `;
}

function composePrompt(asset) {
  const layers = asset.layers || {};
  return [
    `TASK LAYER: ${layers.task || ""}`,
    `FACT LAYER: ${layers.fact || ""}`,
    `SCENE LAYER: ${layers.scene || ""}`,
    `STYLE LAYER: ${layers.style || ""}`,
    `CONVERSION LAYER: ${layers.conversion || ""}`
  ].join("\\n\\n");
}

function updatePromptPreview(card) {
  const asset = readAssetCard(card);
  card.querySelector("[data-prompt]").value = composePrompt(asset);
}

async function saveAssetLayers(assetId) {
  if (!activeProject) return;
  const card = assetList.querySelector(`[data-asset-id="${cssEscape(assetId)}"]`);
  const asset = readAssetCard(card);
  projectMessage.textContent = "Saving prompt layers...";

  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(activeProject.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assets: [asset] })
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message || "Could not save prompt layers.");

    projectMessage.textContent = "Prompt layers saved.";
    await loadProject(activeProject.id);
  } catch (error) {
    projectMessage.textContent = error.message;
  }
}

function readAssetCard(card) {
  const layers = {};
  card.querySelectorAll("[data-layer-input]").forEach((field) => {
    layers[field.dataset.layerInput] = field.value;
  });

  return {
    id: card.dataset.assetId,
    layers,
    prompt: card.querySelector("[data-prompt]").value,
    negativePrompt: card.querySelector("[data-negative-prompt]").value
  };
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(value);
  return String(value).replaceAll('"', '\\"');
}
