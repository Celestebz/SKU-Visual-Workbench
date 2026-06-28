#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const samples = [
  ["fragrance", "examples/fragrance.txt"],
  ["fashion", "examples/fashion.txt"],
  ["promo", "examples/promo.txt"]
];

function run(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd: ROOT, maxBuffer: 1024 * 1024 * 4 }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

await mkdir(path.join(ROOT, "outputs", "samples"), { recursive: true });

for (const [name, file] of samples) {
  const brief = (await readFile(path.join(ROOT, file), "utf8")).trim();
  const outDir = path.join(ROOT, "outputs", "samples", name);
  console.log(`Running sample: ${name}`);
  await run("node", ["scripts/social-visual-pack.mjs", "--mock", "--out", outDir, brief]);
}

console.log("All samples generated under outputs/samples/");
