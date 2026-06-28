#!/usr/bin/env node

import { parseArgs, runWorkflow } from "../src/workflow.mjs";

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await runWorkflow(options, { log: (message) => console.log(message) });

  console.log(`完成：${options.outDir}`);
  console.log("关键文件：brief.json, prompts.md, social-copy.md, quality-report.md, showcase.md, images/");
}

main().catch((error) => {
  console.error("生成失败：", error.message);
  if (error.stderr) console.error(error.stderr.trim());
  process.exit(1);
});
