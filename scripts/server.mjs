#!/usr/bin/env node

import { DEFAULT_PORT, startServer } from "../src/server.mjs";

const portArgIndex = process.argv.indexOf("--port");
const port = portArgIndex >= 0 ? Number(process.argv[portArgIndex + 1]) : Number(process.env.PORT || DEFAULT_PORT);

startServer({ port })
  .then(({ host, port: activePort }) => {
    console.log(`SKU Visual Workbench API running at http://${host}:${activePort}/api`);
    console.log("Health: /api/health");
    console.log("Bailian auth: /api/auth/status");
  })
  .catch((error) => {
    console.error("Failed to start local API service:", error.message);
    process.exit(1);
  });
