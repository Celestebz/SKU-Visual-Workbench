const authCard = document.querySelector("#auth-card");
const authTitle = document.querySelector("#auth-title");
const authDetail = document.querySelector("#auth-detail");
const authGuidance = document.querySelector("#auth-guidance");
const projectForm = document.querySelector("#project-form");
const projectMessage = document.querySelector("#project-message");
const projectList = document.querySelector("#project-list");
const activeProjectIds = new Set();

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
  activeProjectIds.clear();
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
    fillProjectForm(body.project);
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
