const authCard = document.querySelector("#auth-card");
const authTitle = document.querySelector("#auth-title");
const authDetail = document.querySelector("#auth-detail");
const authGuidance = document.querySelector("#auth-guidance");

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
