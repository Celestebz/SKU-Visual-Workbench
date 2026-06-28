#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

export const DEFAULT_BRIEF =
  "帮我为一款夏季香氛产品生成 Instagram 和 Facebook 宣传图，风格高级清爽，目标用户是欧美年轻女性。";

export const PLATFORM_VARIANTS = [
  {
    id: "instagram-feed",
    label: "Instagram Feed",
    ratio: "1:1",
    size: "1080*1080",
    intent: "square mobile feed visual with an immediately recognizable product hero"
  },
  {
    id: "instagram-portrait",
    label: "Instagram Portrait",
    ratio: "4:5",
    size: "1080*1350",
    intent: "portrait feed visual optimized for thumb-stopping mobile browsing"
  },
  {
    id: "instagram-story",
    label: "Instagram Story/Reels Cover",
    ratio: "9:16",
    size: "1080*1920",
    intent: "vertical full-screen story cover with clean safe space for UI overlays"
  },
  {
    id: "facebook-feed",
    label: "Facebook Feed",
    ratio: "1.91:1",
    size: "1200*628",
    intent: "landscape feed creative with clear product context and readable composition"
  }
];

export const ASSET_TYPES = [
  {
    id: "main",
    label: "Main Product Image",
    task: "clean product trust image",
    conversion_goal: "make the shopper instantly understand the product shape, finish, and quality"
  },
  {
    id: "lifestyle",
    label: "Lifestyle Scene Image",
    task: "platform-native lifestyle use scene",
    conversion_goal: "make the shopper imagine the product fitting naturally into their daily life"
  },
  {
    id: "selling-point",
    label: "Selling Point Image",
    task: "visualize one or two beginner-friendly selling points without turning the image into a text-heavy poster",
    conversion_goal: "make the shopper remember why this SKU is suitable for them"
  },
  {
    id: "ad-test",
    label: "Ad Test Creative",
    task: "thumb-stopping paid/social test creative",
    conversion_goal: "earn a first look while keeping the product and audience fit credible"
  }
];

export function parseArgs(argv) {
  const options = {
    brief: "",
    outDir: path.join(ROOT, "outputs"),
    textModel: "qwen-plus",
    imageModel: "qwen-image-2.0",
    premiumImageModel: "qwen-image-max",
    referenceImage: "",
    variants: "",
    assetTypes: "",
    skuPack: false,
    usePremium: false,
    mock: false,
    skipImages: false,
    n: "1"
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out") options.outDir = path.resolve(argv[++i]);
    else if (arg === "--text-model") options.textModel = argv[++i];
    else if (arg === "--image-model") options.imageModel = argv[++i];
    else if (arg === "--premium-model") options.premiumImageModel = argv[++i];
    else if (arg === "--reference-image") options.referenceImage = path.resolve(argv[++i]);
    else if (arg === "--variants") options.variants = argv[++i];
    else if (arg === "--asset-types") options.assetTypes = argv[++i];
    else if (arg === "--sku-pack") options.skuPack = true;
    else if (arg === "--premium") options.usePremium = true;
    else if (arg === "--mock") options.mock = true;
    else if (arg === "--skip-images") options.skipImages = true;
    else if (arg === "--n") options.n = argv[++i];
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      options.brief += `${options.brief ? " " : ""}${arg}`;
    }
  }

  options.brief = options.brief.trim() || DEFAULT_BRIEF;
  options.imageModel = options.usePremium ? options.premiumImageModel : options.imageModel;
  options.platformVariants = selectPlatformVariants(options.variants);
  options.assetTypeVariants = selectAssetTypes(options.assetTypes, options.skuPack);
  return options;
}

export function selectPlatformVariants(value) {
  if (!value) return PLATFORM_VARIANTS;
  const requested = new Set(value.split(",").map((item) => item.trim()).filter(Boolean));
  const selected = PLATFORM_VARIANTS.filter((variant) => requested.has(variant.id));
  if (!selected.length) {
    throw new Error(`Unknown variant "${value}". Use one or more of: ${PLATFORM_VARIANTS.map((item) => item.id).join(", ")}`);
  }
  return selected;
}

export function selectAssetTypes(value, skuPack) {
  if (!value && !skuPack) return ASSET_TYPES.filter((asset) => asset.id === "lifestyle");
  if (!value && skuPack) return ASSET_TYPES;
  const requested = new Set(value.split(",").map((item) => item.trim()).filter(Boolean));
  const selected = ASSET_TYPES.filter((asset) => requested.has(asset.id));
  if (!selected.length) {
    throw new Error(`Unknown asset type "${value}". Use one or more of: ${ASSET_TYPES.map((item) => item.id).join(", ")}`);
  }
  return selected;
}

export function printHelp() {
  console.log(`Usage:
  npm run social -- "你的产品/活动需求"
  npm run social -- --mock "你的产品/活动需求"

Options:
  --out <dir>             Output directory. Default: ./outputs
  --text-model <model>    Text model. Default: qwen-plus
  --image-model <model>   Image model. Default: qwen-image-2.0
  --reference-image <path> Use a product image as visual reference
  --variants <ids>        Comma-separated platform variants. Example: instagram-portrait
  --asset-types <ids>     Comma-separated assets: main,lifestyle,selling-point,ad-test
  --sku-pack              Generate a single-SKU visual pack with all asset types
  --premium              Use qwen-image-max for a more polished commercial look
  --skip-images           Generate brief, prompts, copy, and showcase only
  --mock                 No API calls; generate a complete demo package
  --n <count>             Images per platform request. Default: 1
`);
}

export function run(command, args, { input } = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(command, args, { maxBuffer: 1024 * 1024 * 12 }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
    if (input) child.stdin.end(input);
  });
}

export async function callTextModel(options, system, user) {
  const { stdout } = await run("bl", [
    "text",
    "chat",
    "--model",
    options.textModel,
    "--system",
    system,
    "--message",
    user,
    "--output",
    "json",
    "--non-interactive"
  ]);
  return extractModelText(stdout);
}

export function extractModelText(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed);
    return (
      parsed.output?.text ||
      parsed.output?.choices?.[0]?.message?.content ||
      parsed.choices?.[0]?.message?.content ||
      parsed.message?.content ||
      parsed.content ||
      parsed.text ||
      trimmed
    );
  } catch {
    return trimmed;
  }
}

export function extractJsonObject(text) {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`Model response did not include JSON:\n${text}`);
    return JSON.parse(match[0]);
  }
}

export function buildBriefSystem() {
  return `You are a senior overseas social media creative strategist.
Return strict JSON only. Do not wrap it in Markdown.
Use English for values that will be used externally, but keep any original product details when useful.
For Instagram product visuals, prefer believable lifestyle context over plain studio/e-commerce product shots unless the user explicitly asks for studio.
Separate the strategy into business task plus creative layers:
- task_layer: what sales/content job this image pack is doing.
- fact_layer: product facts and fixed details that must not drift.
- scene_layer: space, action, props, composition, lens, light, and color.
- style_layer: emotional tone, texture, realism, and platform-native aesthetic.
- conversion_layer: what the shopper should feel, understand, or do after seeing it.
The JSON shape must be:
{
  "campaign_name": string,
  "product": string,
  "target_market": string,
  "audience": string,
  "platforms": string[],
  "visual_style": string,
  "task_layer": string[],
  "fact_layer": string[],
  "scene_layer": string[],
  "style_layer": string[],
  "conversion_layer": string[],
  "key_selling_points": string[],
  "must_include": string[],
  "avoid": string[],
  "tone": string,
  "quality_checks": string[]
}`;
}

export function buildPromptSystem() {
  return `You are an expert prompt engineer for commercial social media images.
Return strict JSON only. Do not wrap it in Markdown.
Create platform-specific English image prompts for Instagram and Facebook.
Each prompt must be built as a five-layer prompt:
1. TASK LAYER: the sales/content job for this asset type.
2. FACT LAYER: product identity, subject state, exact details to preserve, what can/cannot change.
3. SCENE LAYER: space, natural product placement, human-use cues, props, foreground/background depth, lens, framing, light, color.
4. STYLE LAYER: emotional mood, texture, realism, platform-native Instagram/Facebook aesthetic, low-advertising-feel guidance.
5. CONVERSION LAYER: the viewer belief or action this image should support.
For Instagram, avoid plain seamless backgrounds and stiff catalog poses. Put the product into a believable aspirational use scene. Props are welcome when they support the target user and do not block the product.
For beginner electric guitar visuals, use a warm practice-room, bedroom-studio, desk/amp corner, morning rehearsal, first-riff lifestyle context. The product should feel approachable, not like a heavy rock stage or isolated e-commerce object.
Create one prompt for every combination of platform_variants and asset_types. Make each id exactly "{platform_id}-{asset_type_id}".
If a reference image is provided, preserve the product shape, color, hardware, logo placement, and recognizable design while changing only the background, lighting, composition, and social-media styling.
The JSON shape must be:
{
  "variants": [
    {
      "id": string,
      "label": string,
      "ratio": string,
      "size": string,
      "asset_type": string,
      "task_layer": string,
      "fact_layer": string,
      "scene_layer": string,
      "style_layer": string,
      "conversion_layer": string,
      "prompt": string,
      "negative_prompt": string
    }
  ]
}`;
}

export function buildCopySystem() {
  return `You are an English social media copywriter and light brand-safety reviewer.
Return strict JSON only. Do not wrap it in Markdown.
The JSON shape must be:
{
  "captions": [{"platform": string, "caption": string}],
  "hashtags": string[],
  "alt_text": string,
  "review_notes": string[],
  "publishing_tips": string[]
}`;
}

export function buildQualitySystem() {
  return `You are a senior ecommerce visual production reviewer.
Return strict JSON only. Do not wrap it in Markdown.
Review the planned visual assets for platform fit and production risk. Score based on prompt quality and asset strategy, not pixel inspection.
The JSON shape must be:
{
  "overall_score": number,
  "best_asset_id": string,
  "asset_reviews": [
    {
      "id": string,
      "score": number,
      "publish_readiness": "ready" | "needs_retry" | "manual_polish",
      "strengths": string[],
      "risks": string[],
      "retry_instruction": string
    }
  ]
}`;
}

export async function generateBrief(options) {
  if (options.mock) return mockBrief(options.brief);
  const user = options.referenceImage
    ? `${options.brief}\n\nReference product image path: ${options.referenceImage}\nUse it as the source product visual.`
    : options.brief;
  const text = await callTextModel(options, buildBriefSystem(), user);
  return extractJsonObject(text);
}

export async function generatePrompts(options, brief) {
  if (options.mock) return mockPrompts(brief, options.platformVariants, options.assetTypeVariants);
  const text = await callTextModel(
    options,
    buildPromptSystem(),
    JSON.stringify(
      {
        brief,
        reference_image: options.referenceImage || null,
        platform_variants: options.platformVariants,
        asset_types: options.assetTypeVariants
      },
      null,
      2
    )
  );
  const result = extractJsonObject(text);
  return {
    variants: combinePlatformAssets(options.platformVariants, options.assetTypeVariants).map(({ platform, asset }) => {
      const id = `${platform.id}-${asset.id}`;
      const generated = result.variants?.find((item) => item.id === id) || {};
      const prompt = generated.prompt || "";
      return {
        ...generated,
        ...platform,
        id,
        label: `${platform.label} / ${asset.label}`,
        asset_type: asset.id,
        prompt: options.referenceImage ? withReferenceGuard(prompt, brief) : prompt,
        task_layer: generated.task_layer || asset.task,
        fact_layer: generated.fact_layer || "",
        scene_layer: generated.scene_layer || "",
        style_layer: generated.style_layer || "",
        conversion_layer: generated.conversion_layer || asset.conversion_goal,
        negative_prompt: generated.negative_prompt || ""
      };
    })
  };
}

export function combinePlatformAssets(platformVariants, assetTypes) {
  return platformVariants.flatMap((platform) => assetTypes.map((asset) => ({ platform, asset })));
}

export function withReferenceGuard(prompt, brief) {
  const product = brief.product || "the reference product";
  return [
    `Use the reference image as the exact source product for ${product}. Preserve the original product shape, color, finish, hardware, strings, pickups, knobs, logo placement, and recognizable design. Change only the background, lighting, composition, props, and social-media styling. Do not turn it into a plain catalog or seamless-background studio shot; place it in a believable lifestyle scene.`,
    prompt
  ].join(" ");
}

export async function generateCopy(options, brief, prompts) {
  if (options.mock) return mockCopy(brief);
  const text = await callTextModel(
    options,
    buildCopySystem(),
    JSON.stringify({ brief, prompts }, null, 2)
  );
  return extractJsonObject(text);
}

export async function generateQualityReport(options, brief, prompts, images) {
  if (options.mock) return mockQualityReport(prompts);
  const text = await callTextModel(
    options,
    buildQualitySystem(),
    JSON.stringify({ brief, prompts, images }, null, 2)
  );
  return extractJsonObject(text);
}

export async function generateImages(options, prompts) {
  const imagesDir = path.join(options.outDir, "images");
  await mkdir(imagesDir, { recursive: true });

  if (options.skipImages) return [];
  if (options.mock) return writeMockImages(imagesDir, prompts.variants);

  const generated = [];
  for (const variant of prompts.variants) {
    const before = new Set(await listFiles(imagesDir));
    const imageArgs = options.referenceImage
      ? [
          "image",
          "edit",
          "--image",
          options.referenceImage,
          "--prompt",
          variant.prompt,
          "--model",
          options.imageModel,
          "--size",
          normalizeSize(variant.size),
          "--n",
          options.n,
          "--negative-prompt",
          variant.negative_prompt || "",
          "--watermark",
          "false",
          "--prompt-extend",
          "true",
          "--out-dir",
          imagesDir,
          "--out-prefix",
          variant.id,
          "--non-interactive"
        ]
      : [
          "image",
          "generate",
          "--model",
          options.imageModel,
          "--prompt",
          variant.prompt,
          "--negative-prompt",
          variant.negative_prompt || "",
          "--size",
          normalizeSize(variant.size),
          "--n",
          options.n,
          "--watermark",
          "false",
          "--prompt-extend",
          "true",
          "--out-dir",
          imagesDir,
          "--out-prefix",
          variant.id,
          "--non-interactive"
        ];
    await run("bl", imageArgs);
    const after = await listFiles(imagesDir);
    const files = after.filter((file) => !before.has(file));
    generated.push({ id: variant.id, label: variant.label, files });
  }
  return generated;
}

export function normalizeSize(size) {
  return String(size).replace("x", "*").replace("X", "*");
}

export async function listFiles(dir) {
  try {
    return (await readdir(dir)).sort();
  } catch {
    return [];
  }
}

export async function writeMockImages(imagesDir, variants) {
  const generated = [];
  for (const variant of variants) {
    const filename = `${variant.id}.svg`;
    const filePath = path.join(imagesDir, filename);
    await writeFile(filePath, renderMockSvg(variant), "utf8");
    generated.push({ id: variant.id, label: variant.label, files: [filename] });
  }
  return generated;
}

export function renderMockSvg(variant) {
  const [w, h] = variant.size.split("*").map((value) => Number(value));
  const title = escapeXml(variant.label);
  const ratio = escapeXml(variant.ratio);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f7fbf8"/>
      <stop offset="45%" stop-color="#d7efe6"/>
      <stop offset="100%" stop-color="#f3d7c4"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="${w * 0.14}" y="${h * 0.14}" width="${w * 0.72}" height="${h * 0.72}" rx="24" fill="rgba(255,255,255,0.58)" stroke="#ffffff"/>
  <text x="50%" y="45%" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.max(34, Math.round(w / 28))}" fill="#24342f" font-weight="700">${title}</text>
  <text x="50%" y="53%" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.max(22, Math.round(w / 44))}" fill="#52655f">Mock visual placeholder</text>
  <text x="50%" y="59%" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.max(18, Math.round(w / 58))}" fill="#6f817b">${ratio} · ${variant.size}</text>
</svg>`;
}

export function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function mockBrief(sourceBrief) {
  if (sourceBrief.includes("电吉他") || sourceBrief.toLowerCase().includes("guitar")) {
    return {
      campaign_name: "First Electric Guitar Instagram Launch",
      product: "pink-to-black gradient electric guitar for beginners",
      target_market: "United States and English-speaking overseas markets",
      audience: "beginner electric guitar players who want a stylish, approachable first instrument",
      platforms: ["Instagram"],
      visual_style: "premium, fresh, clean, modern music lifestyle, bright but not childish",
      task_layer: [
        "single-SKU visual production for Instagram",
        "turn one product photo into main image, lifestyle scene, selling point image, and ad test creative"
      ],
      fact_layer: [
        "pink-to-black gradient electric guitar",
        "black pickguard",
        "chrome/silver hardware",
        "strings, pickups, knobs, bridge, tremolo arm, and headstock logo placement preserved"
      ],
      scene_layer: [
        "Instagram 4:5 lifestyle scene",
        "bright bedroom-studio practice corner",
        "small amp, guitar cable, open beginner chord notebook, headphones, and soft fabric chair nearby",
        "product naturally leaning on a stand with enough clear space around the full silhouette"
      ],
      style_layer: [
        "premium but approachable beginner energy",
        "fresh daylight, warm neutrals, subtle mint or blush accents",
        "realistic social media photography, not a catalog render"
      ],
      conversion_layer: [
        "make beginners feel this guitar is stylish but not intimidating",
        "help shoppers imagine their first practice moment at home",
        "make the gradient finish memorable in a crowded feed"
      ],
      key_selling_points: ["beginner-friendly appeal", "distinctive pink-to-black gradient finish", "stage-ready electric guitar look"],
      must_include: ["the original guitar as product hero", "4:5 Instagram portrait composition", "believable lifestyle practice setting"],
      avoid: ["heavy metal cliches", "dark cluttered stage", "fake brand changes", "plain seamless product catalog background", "overly aggressive advertising text"],
      tone: "confident, friendly, polished, and encouraging",
      quality_checks: [
        "Preserves the guitar shape, gradient finish, and hardware",
        "Fits Instagram 4:5 mobile browsing",
        "Appeals to overseas beginner players",
        "Feels premium and fresh",
        "Avoids crowded or intimidating music stereotypes"
      ]
    };
  }
  return {
    campaign_name: "Summer Scent Social Launch",
    product: sourceBrief.includes("香氛") ? "summer fragrance product" : "cross-border ecommerce product",
    target_market: "United States and English-speaking overseas markets",
    audience: "young women who enjoy fresh, premium lifestyle products",
    platforms: ["Instagram", "Facebook"],
    visual_style: "fresh, premium, airy, editorial lifestyle, soft natural light",
    key_selling_points: ["light summer mood", "premium bottle design", "giftable lifestyle appeal"],
    must_include: ["product hero", "seasonal atmosphere", "clean negative space"],
    avoid: ["crowded layouts", "heavy discount language", "overly artificial AI look", "medical or absolute claims"],
    tone: "elegant, warm, confident, and lightly aspirational",
    quality_checks: [
      "Fits overseas social media aesthetics",
      "Does not feel overly salesy",
      "Avoids exaggerated claims",
      "Keeps text minimal",
      "Works on mobile first-screen browsing"
    ]
  };
}

export function mockPrompts(brief, platformVariants = PLATFORM_VARIANTS, assetTypes = [ASSET_TYPES[1]]) {
  return {
    variants: combinePlatformAssets(platformVariants, assetTypes).map(({ platform, asset }) => ({
      ...platform,
      id: `${platform.id}-${asset.id}`,
      label: `${platform.label} / ${asset.label}`,
      asset_type: asset.id,
      task_layer: asset.task,
      fact_layer: buildMockFactLayer(brief),
      scene_layer: buildMockSceneLayer(brief, asset),
      style_layer: buildMockStyleLayer(brief, asset),
      conversion_layer: asset.conversion_goal,
      prompt: buildMockPrompt(brief, platform, asset),
      negative_prompt: buildMockNegativePrompt(brief)
    }))
  };
}

export function buildMockFactLayer(brief) {
  if (brief.product.includes("electric guitar")) {
    return "Preserve the reference guitar exactly: pink-to-black gradient body, black pickguard, chrome/silver hardware, strings, pickups, knobs, bridge, tremolo arm, and headstock logo placement.";
  }
  return `Preserve the exact product identity and packaging details for ${brief.product}.`;
}

export function buildMockSceneLayer(brief, asset) {
  if (!brief.product.includes("electric guitar")) {
    return "Use a fresh lifestyle scene with clear product focus, natural light, and platform-safe negative space.";
  }
  const scenes = {
    main: "Clean but warm product trust image in a bright home practice corner, guitar on a simple stand, light oak floor, soft wall texture, minimal beginner accessories kept secondary.",
    lifestyle: "Bedroom-studio practice moment with small amp, open beginner chord notebook, laptop lesson, headphones, coffee, soft chair, window daylight, and natural human-use cues.",
    "selling-point": "Beginner-friendly visual explainer without heavy text: guitar foreground plus neatly arranged starter cues such as chord notebook, tuner, cable, and strap as small supporting props.",
    "ad-test": "Thumb-stopping Instagram crop with guitar entering diagonally through foreground, colorful gradient emphasized by window light, laptop lesson and practice props blurred in the background."
  };
  return scenes[asset.id] || scenes.lifestyle;
}

export function buildMockStyleLayer(brief, asset) {
  if (brief.product.includes("electric guitar")) {
    return `Premium, fresh, approachable, overseas Instagram-native, realistic lifestyle photography, low advertising feel, not a rock stage or ecommerce catalog; ${asset.conversion_goal}.`;
  }
  return "Premium overseas social media lifestyle, realistic materials, soft editorial light, low advertising feel.";
}

export function buildMockNegativePrompt(brief) {
  if (brief.product.includes("electric guitar")) {
    return "distorted guitar, changed guitar color, wrong pickguard, missing strings, incorrect pickups, incorrect knobs, logo changed, product blocked by props, hands covering the body, messy room, dark rock stage, smoke, neon nightclub lighting, aggressive metal cliches, plain seamless catalog background, floating product, hard-sell text, discount badge, watermark, unreadable text, low quality, blurry, over-smoothed AI render";
  }
  return "low quality, blurry, distorted product, incorrect logo, changed product color, cluttered background, harsh shadows, fake plastic texture, unreadable text, watermark, aggressive discount text, over-saturated colors";
}

export function buildMockPrompt(brief, platform, asset = ASSET_TYPES[1]) {
  if (brief.product.includes("electric guitar")) {
    return `TASK LAYER: ${asset.task}. This asset is for ${platform.label}; ${platform.intent}.

FACT LAYER: Use the reference product image as the exact hero product: a pink-to-black gradient electric guitar with black pickguard and chrome hardware. Preserve the guitar shape, gradient finish, headstock logo placement, strings, pickups, knobs, bridge, tremolo arm, and hardware.

SCENE LAYER: ${buildMockSceneLayer(brief, asset)} Keep the guitar readable and naturally placed, with foreground/background depth and enough negative space for Instagram cropping. Use soft window daylight from the left, gentle shadows, warm white walls, pale oak floor, subtle mint and blush accents, 50mm lifestyle photography, eye-level vertical framing.

STYLE LAYER: ${buildMockStyleLayer(brief, asset)}

CONVERSION LAYER: ${asset.conversion_goal}. No embedded text unless the asset type explicitly needs a tiny readable label; keep it mostly visual and Instagram-native.`;
  }
  return `Premium overseas social media product photography for ${brief.product}, ${platform.intent}. Fresh summer lifestyle scene, elegant product hero, soft morning sunlight, clean botanical accents, dewy glass texture, refined pastel green and warm ivory palette, editorial composition, realistic commercial photography, natural shadows, high-end beauty brand mood, minimal text-free layout, mobile-first clarity, not overly promotional.`;
}

export function mockCopy(brief) {
  if (brief.product.includes("electric guitar")) {
    return {
      captions: [
        {
          platform: "Instagram",
          caption: "Your first electric guitar should feel exciting before you even plug in. Clean looks, confident tone, and a finish made for your first riffs."
        }
      ],
      hashtags: ["#ElectricGuitar", "#BeginnerGuitar", "#FirstGuitar", "#GuitarPractice", "#NewGuitarDay", "#GuitarForBeginners"],
      alt_text:
        "A pink-to-black gradient electric guitar styled in a clean modern practice space for beginner guitar players.",
      review_notes: [
        "Keeps the tone encouraging for beginners rather than intimidating.",
        "Avoids unverifiable claims about sound quality or skill improvement.",
        "Uses a clean 4:5 Instagram-friendly composition with minimal text."
      ],
      publishing_tips: [
        "Use this 4:5 portrait version for Instagram feed.",
        "Open the caption with an emotional beginner-friendly hook.",
        "Pair with a short Reel showing first chords or setup details."
      ]
    };
  }
  return {
    captions: [
      {
        platform: "Instagram",
        caption: `Fresh air, soft light, and a scent that feels like summer. Meet ${brief.product}, made for slow mornings and golden-hour plans.`
      },
      {
        platform: "Facebook",
        caption: `Bring a lighter summer mood into your everyday routine with ${brief.product}. Clean, fresh, and easy to love.`
      }
    ],
    hashtags: ["#SummerScent", "#FragranceLovers", "#CleanBeauty", "#LifestyleAesthetic", "#NewSeasonStyle"],
    alt_text: `A fresh premium lifestyle image featuring ${brief.product} in a clean summer setting with soft natural light.`,
    review_notes: [
      "The copy avoids absolute performance claims.",
      "The visuals should keep product and seasonal mood clear on mobile.",
      "Use minimal embedded text for stronger platform compatibility."
    ],
    publishing_tips: [
      "Use the 4:5 version for Instagram feed reach.",
      "Reserve the 9:16 version for Story or Reels cover.",
      "A/B test the caption opening line if running paid social."
    ]
  };
}

export function mockQualityReport(prompts) {
  const reviews = prompts.variants.map((variant, index) => ({
    id: variant.id,
    score: Math.max(78, 92 - index * 3),
    publish_readiness: index === 0 ? "ready" : "needs_retry",
    strengths: [
      "Layered prompt keeps product facts separate from scene and style decisions.",
      "Asset task is clear enough for business review before image generation."
    ],
    risks: [
      variant.asset_type === "selling-point"
        ? "Selling-point images can become too text-heavy if the model adds labels."
        : "Reference-image editing may slightly drift hardware details."
    ],
    retry_instruction:
      "If retrying, preserve the fact layer exactly, simplify props by 20%, and strengthen the natural-use context without adding hard-sell text."
  }));
  return {
    overall_score: Math.round(reviews.reduce((sum, item) => sum + item.score, 0) / reviews.length),
    best_asset_id: reviews[0]?.id || "",
    asset_reviews: reviews
  };
}

export function renderPromptsMarkdown(prompts) {
  return [
    "# Overseas Social Visual Prompts",
    "",
    ...prompts.variants.flatMap((variant) => [
      `## ${variant.label}`,
      "",
      `- Ratio: ${variant.ratio}`,
      `- Size: ${variant.size}`,
      `- Asset type: ${variant.asset_type || "lifestyle"}`,
      "",
      "### Task Layer",
      "",
      variant.task_layer || "(included in prompt)",
      "",
      "### Fact Layer",
      "",
      variant.fact_layer || "(included in prompt)",
      "",
      "### Scene Layer",
      "",
      variant.scene_layer || "(included in prompt)",
      "",
      "### Style Layer",
      "",
      variant.style_layer || "(included in prompt)",
      "",
      "### Conversion Layer",
      "",
      variant.conversion_layer || "(included in prompt)",
      "",
      "### Prompt",
      "",
      variant.prompt,
      "",
      "### Negative Prompt",
      "",
      variant.negative_prompt || "(none)",
      ""
    ])
  ].join("\n");
}

export function renderCopyMarkdown(copy) {
  return [
    "# Social Copy",
    "",
    "## Captions",
    "",
    ...copy.captions.map((item) => `### ${item.platform}\n\n${item.caption}\n`),
    "## Hashtags",
    "",
    copy.hashtags.join(" "),
    "",
    "## Alt Text",
    "",
    copy.alt_text,
    "",
    "## Review Notes",
    "",
    ...copy.review_notes.map((note) => `- ${note}`),
    "",
    "## Publishing Tips",
    "",
    ...copy.publishing_tips.map((tip) => `- ${tip}`),
    ""
  ].join("\n");
}

export function renderQualityMarkdown(report) {
  return [
    "# Quality Report",
    "",
    `- Overall score: ${report.overall_score}`,
    `- Best asset: ${report.best_asset_id}`,
    "",
    ...report.asset_reviews.flatMap((item) => [
      `## ${item.id}`,
      "",
      `- Score: ${item.score}`,
      `- Publish readiness: ${item.publish_readiness}`,
      "",
      "### Strengths",
      "",
      ...item.strengths.map((strength) => `- ${strength}`),
      "",
      "### Risks",
      "",
      ...item.risks.map((risk) => `- ${risk}`),
      "",
      "### Retry Instruction",
      "",
      item.retry_instruction,
      ""
    ])
  ].join("\n");
}

export function renderShowcase({ options, brief, prompts, copy, images, quality }) {
  return [
    "# 海外社媒配图生成工作流",
    "",
    "## 我做了什么",
    "",
    "用一条自然语言需求，自动生成单 SKU 海外视觉生产包：商品理解、销售任务拆解、任务层/事实层/画面层/风格层/转化层提示词、平台尺寸版本、caption、hashtags、alt text 和质检建议。",
    "",
    "## 使用的工具",
    "",
    `- Text model: ${options.textModel}`,
    `- Image model: ${options.imageModel}`,
    `- Asset types: ${options.assetTypeVariants.map((item) => item.id).join(", ")}`,
    "- CLI: 阿里云百炼 bl",
    "",
    "## 原始需求",
    "",
    options.brief,
    "",
    "## 需求拆解",
    "",
    `- Campaign: ${brief.campaign_name}`,
    `- Product: ${brief.product}`,
    `- Audience: ${brief.audience}`,
    `- Style: ${brief.visual_style}`,
    `- Selling points: ${brief.key_selling_points.join(", ")}`,
    `- Task layer: ${(brief.task_layer || []).join("; ")}`,
    `- Conversion layer: ${(brief.conversion_layer || []).join("; ")}`,
    "",
    "## 效果展示",
    "",
    ...prompts.variants.map((variant) => {
      const imageGroup = images.find((image) => image.id === variant.id);
      const files = imageGroup?.files?.length ? imageGroup.files.join(", ") : "not generated";
      return `- ${variant.label}: ${variant.ratio}, ${variant.size}, files: ${files}`;
    }),
    "",
    "## 发布文案",
    "",
    ...copy.captions.map((item) => `- ${item.platform}: ${item.caption}`),
    "",
    "## 质检结论",
    "",
    `- Overall score: ${quality.overall_score}`,
    `- Best asset: ${quality.best_asset_id}`,
    "",
    "## Hashtags",
    "",
    copy.hashtags.join(" "),
    "",
    "## 踩坑记录",
    "",
    "- 海外社媒图需要控制广告感，避免把画面做成传统促销海报。",
    "- 不同平台比例差异大，同一张图直接裁切容易损失主体，所以每个平台单独生成 prompt。",
    "- 单张生成不够稳定，改为主图/场景图/卖点图/广告图多任务拆解，并用质检报告决定是否重抽。",
    "- 现场演示建议保留 mock 模式，网络或额度异常时也能展示完整流程。",
    ""
  ].join("\n");
}

export async function runWorkflow(options, { log = () => {} } = {}) {
  await mkdir(options.outDir, { recursive: true });

  log("1/6 拆解需求...");
  const brief = await generateBrief(options);
  await writeFile(path.join(options.outDir, "brief.json"), `${JSON.stringify(brief, null, 2)}\n`, "utf8");

  log("2/6 生成英文图片提示词...");
  const prompts = await generatePrompts(options, brief);
  await writeFile(path.join(options.outDir, "prompts.md"), renderPromptsMarkdown(prompts), "utf8");

  log("3/6 生成平台配图...");
  const images = await generateImages(options, prompts);

  log("4/6 生成发布文案...");
  const copy = await generateCopy(options, brief, prompts);
  await writeFile(path.join(options.outDir, "social-copy.md"), renderCopyMarkdown(copy), "utf8");

  log("5/6 生成质量报告...");
  const quality = await generateQualityReport(options, brief, prompts, images);
  await writeFile(path.join(options.outDir, "quality-report.md"), renderQualityMarkdown(quality), "utf8");

  log("6/6 生成 Workshop 展示稿...");
  await writeFile(
    path.join(options.outDir, "showcase.md"),
    renderShowcase({ options, brief, prompts, copy, images, quality }),
    "utf8"
  );

  return { options, brief, prompts, images, copy, quality };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await runWorkflow(options, { log: (message) => console.log(message) });

  console.log(`完成：${options.outDir}`);
  console.log("关键文件：brief.json, prompts.md, social-copy.md, quality-report.md, showcase.md, images/");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("生成失败：", error.message);
    if (error.stderr) console.error(error.stderr.trim());
    process.exit(1);
  });
}
