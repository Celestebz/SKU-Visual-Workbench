# 海外社媒配图生成工作流

这是一个面向 Workshop 演示的最小命令行工作流：输入一句产品/活动需求，自动生成 Instagram 和 Facebook 可用的海外社媒发布包。

## 快速开始

先确认已经登录阿里云百炼 CLI：

```bash
bl auth status
```

启动本地工作台：

```bash
npm run app
```

浏览器打开：

```text
http://127.0.0.1:4173/
```

检查服务是否启动：

```bash
curl http://127.0.0.1:4173/api/health
```

检查百炼登录状态：

```bash
curl http://127.0.0.1:4173/api/auth/status
```

`npm run api` 也可启动同一个本地服务；保留这个别名是为了后续前端/后端调试时语义更清楚。

工作台现在支持本地项目历史：

- 在左侧填写 SKU 信息和参考图路径
- 点击 `Save local project`
- 项目会保存到本机 `projects/` 目录
- 右侧 `Local project history` 可以重新打开历史项目
- 点击 `Generate prompt plan` 可以生成 Instagram 4 类素材提示词
- 中间区域可以编辑任务层、事实层、画面层、风格层、转化层和负面提示词
- 点击 `Save prompt layers` 会把编辑后的提示词保存回本地项目

`projects/` 已加入 `.gitignore`，不会上传到 GitHub。

生成真实发布包：

```bash
npm run social -- "帮我为一款夏季香氛产品生成 Instagram 和 Facebook 宣传图，风格高级清爽，目标用户是欧美年轻女性。"
```

生成单 SKU 视觉生产包：

```bash
npm run social -- --sku-pack --variants instagram-portrait --reference-image "/path/to/product.png" "产品是一款电吉他，目标平台 Instagram，风格高级清爽，目标用户欧美电吉他新手。图片尺寸是4:5"
```

没有 Key、网络或额度时，可以跑完整离线演示：

```bash
npm run demo
```

一次性跑计划里的 3 个验收样例：

```bash
npm run samples
```

## 输出内容

默认输出到 `outputs/`：

- `brief.json`：需求拆解结果
- `prompts.md`：各平台英文图片提示词
- `images/`：平台配图
- `social-copy.md`：英文 caption、hashtags、alt text 和发布建议
- `quality-report.md`：素材质检、推荐发布资产和重抽建议
- `showcase.md`：可复制到 ModelStudio/Workshop 的作品说明

## 常用选项

```bash
npm run social -- --mock "你的产品需求"
npm run social -- --skip-images "只生成 brief、prompt 和文案"
npm run social -- --premium "使用 qwen-image-max 生成更高质感图片"
npm run social -- --out ./outputs/fragrance "指定输出目录"
npm run social -- --sku-pack "生成主图、场景图、卖点图、广告测试图"
npm run social -- --asset-types lifestyle,ad-test "只生成指定素材类型"
```

默认模型：

- 文本拆解与文案：`qwen-plus`
- 图片生成：`qwen-image-2.0`
- 高质感模式：`qwen-image-max`

## 开发入口

CLI 和未来本地 Web App 共用同一套工作流入口：

```js
import { parseArgs, runWorkflow } from "./src/workflow.mjs";

const options = parseArgs(["--mock", "--skip-images", "产品需求"]);
const result = await runWorkflow(options);
```

`scripts/social-visual-pack.mjs` 仍然可以直接作为命令行使用；被 `import` 时不会自动执行。

## 换电脑配置百炼

GitHub 仓库不会保存任何 API Key。换电脑后，在新电脑单独配置百炼 CLI：

```bash
bl --version
bl auth login
bl auth status
```

如果本地工作台显示未登录，前端会显示同样的引导：

1. 安装或确认百炼 CLI 可用：`bl --version`
2. 登录：`bl auth login`
3. 按提示粘贴你自己的百炼 API Key
4. 验证：`bl auth status`

本项目不会在前端、仓库配置或本地项目历史里保存完整密钥。

## Workshop 演示话术

这个项目展示的是“一行指令跑完海外社媒内容线”：

```text
输入产品需求
→ AI 拆解商品、市场、平台、受众和销售任务
→ AI 规划主图 / 场景图 / 卖点图 / 广告测试图
→ AI 生成任务层 / 事实层 / 画面层 / 风格层 / 转化层提示词
→ 百炼生成不同平台和素材类型的图片
→ AI 生成 caption、hashtags、alt text 和审核建议
→ AI 输出质检报告和重抽建议
→ 输出可提交的 showcase.md
```
