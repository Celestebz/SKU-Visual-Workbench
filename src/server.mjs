import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./workflow.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

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

  if (url.pathname.startsWith("/api/")) {
    return jsonResponse(
      404,
      createApiError("NOT_FOUND", `No route for ${req.method} ${url.pathname}`, "Check the API path and method.")
    );
  }

  return jsonResponse(
    404,
    createApiError("NOT_FOUND", "This local service only exposes /api endpoints.", "Use /api/health to verify the service.")
  );
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
  res.end(response.statusCode === 204 ? "" : response.body);
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
