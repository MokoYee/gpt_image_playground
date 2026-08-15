<div align="center">

# 🎨 GPT Image Playground

[![GitHub Repo stars](https://img.shields.io/github/stars/MokoYee/gpt_image_playground?style=flat-square&color=eab308)](https://github.com/MokoYee/gpt_image_playground/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/MokoYee/gpt_image_playground?style=flat-square&color=3b82f6)](https://github.com/MokoYee/gpt_image_playground/network/members)
[![License](https://img.shields.io/badge/license-MIT-10b981?style=flat-square)](LICENSE)
[![React](https://img.shields.io/badge/React-19-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**带用户管理、队列与计费能力的 gpt-image-2 图片生成与编辑平台**

提供简洁精美的 Web UI，支持 OpenAI 兼容模型服务、文本生图、参考图与遮罩编辑。<br>
当前版本已引入 Node.js 后端、PostgreSQL 持久化、用户额度、任务队列和管理控制台，适合以 Docker Compose 方式部署为完整服务。

<br>

[![Docker Image](https://img.shields.io/badge/GHCR-Docker%20Image-0f172a?style=for-the-badge&logo=docker&logoColor=white)](https://github.com/MokoYee/gpt_image_playground/pkgs/container/gpt_image_playground)
&nbsp;&nbsp;&nbsp;
[![Main Build](https://img.shields.io/badge/main-auto%20docker%20build-2563eb?style=for-the-badge&logo=githubactions&logoColor=white)](https://github.com/MokoYee/gpt_image_playground/actions)

</div>

<br>

> 💡 **提示**：本版本不再是纯静态前端应用。Vercel、GitHub Pages、Cloudflare Pages/Workers 等静态部署方式只能承载旧版前端，无法提供登录、额度、队列、历史图片和管理后台。生产或测试环境请使用 Docker Compose 部署完整服务。

---

## 📸 界面预览

<details>
<summary><b>点击展开截图展示</b></summary>
<br>

<div align="center">
  <b>桌面端主界面</b><br>
  <img src="docs/images/example_pc_1.png" alt="桌面端主界面" />
</div>

<br>

<div align="center">
  <b>任务详情与实际参数</b><br>
  <img src="docs/images/example_pc_2.png" alt="任务详情与实际参数" />
</div>

<br>

<div align="center">
  <b>桌面端批量选择</b><br>
  <img src="docs/images/example_pc_3.png" alt="桌面端批量选择" />
</div>

<br>

<div align="center">
  <b>移动端主界面</b><br>
  <img src="docs/images/example_mb_1.jpg" alt="移动端主界面" width="420" />
</div>

<br>

<div align="center">
  <b>移动端侧滑多选</b><br>
  <img src="docs/images/example_mb_2.jpg" alt="移动端侧滑多选" width="420" />
</div>

</details>

---

## ✨ 核心特性

### 🎨 强大的图像生成与编辑
- **双模接口支持**：自由切换使用常规 `Images API` (`/v1/images`) 或 `Responses API` (`/v1/responses`)。
- **参考图与遮罩**：支持上传最多 16 张参考图（支持剪贴板和拖拽）。内置可视化遮罩编辑器，自动预处理以符合官方分辨率限制。
- **批量与迭代**：支持单次多图生成；一键将满意结果转为参考图，无缝开启下一轮修改。

### ⚙️ 精细化参数追踪
- **智能尺寸控制**：提供 1K/2K/4K 快速预设，自定义宽高时会自动规整至模型安全范围（16 的倍数、总像素校验等）。
- **实际参数对比**：自动提取 API 响应中真实生效的尺寸、质量、耗时以及**模型改写后的提示词**，与你的请求参数高亮对比。支持定制化的参数列表横向平滑滚动体验。

### 📁 持久化历史管理
- **瀑布流与画廊**：历史任务自动保存到后端，支持按状态过滤、全屏大图预览与快捷下载。
- **快捷批量操作**：桌面端支持鼠标拖拽框选、Ctrl/⌘ 连选，移动端支持顺滑侧滑多选；轻松实现批量收藏与清理。
- **持久化存储**：任务记录、额度记录、系统设置保存在 PostgreSQL；生成图片默认保存到服务器本地目录，Docker 部署时请挂载图片目录。后续可扩展到 S3 对象存储。

### 🔌 管理后台与模型服务
- **用户管理**：支持注册开关、默认 Credits、用户备注、启用/禁用、软删除、管理员充值/退款、专属倍率和专属并发。
- **队列控制**：支持系统全局并发和默认用户并发。任务超过并发上限时进入队列，前端可查看排队数量并在未开始前取消。
- **模型服务配置**：管理员在控制台维护 OpenAI 兼容模型服务，API Key 保存后不回显；生图请求由后端统一代理调用上游。
- **使用记录与审计**：管理员可按用户、模型、状态、时间和关键字查看使用记录；关键管理操作写入审计日志。
- **Codex CLI 兼容模式**：对上游为 Codex CLI 的 API，开启后应用 Codex CLI 实际支持的参数，并将多图生成拆分为并发单图。
- **提示词防改写**：Responses API 会始终在请求文本前加入强制指令防止提示词被改写；开启 Codex CLI 模式后，Images API 也会获得同等保护。
- **智能诊断提示**：当检测到接口异常改写行为或缺少常规参数时，自动提示开启相应的兼容模式。
- **习惯配置**：支持设置提交后清空输入、重启后保留历史输入、临时复用历史任务 API 配置等。

---

## 🚀 部署与使用

当前版本需要 Node.js 后端和 PostgreSQL。推荐使用 Docker Compose 部署完整服务；静态页面或无服务器部署不再适合作为正式运行方式。

<details>
<summary><strong>🐳 方式一：Docker Compose 部署 (推荐)</strong></summary>

官方镜像已发布至 GitHub Container Registry。数据库请使用已有 PostgreSQL 服务，本项目 compose 不内置数据库。

**1. 准备目录**

```bash
mkdir -p /data/gpt-image-playground/images
cd /data/gpt-image-playground
```

**2. 创建 `.env`**

```env
TZ=Asia/Shanghai
SERVER_PORT=8080
DATABASE_URL=postgresql://用户名:密码@数据库地址:5432/数据库名
JWT_SECRET=请替换为至少32位的随机字符串
JWT_EXPIRES_IN_SECONDS=604800

# 仅在数据库中不存在管理员账号时生效
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=请替换为强密码
```

**3. 创建 `docker-compose.yml`**

```yaml
services:
  gpt-image-playground:
    image: ghcr.io/mokoyee/gpt_image_playground:latest
    container_name: gpt-image-playground
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "${SERVER_PORT:-8080}:8080"
    environment:
      NODE_ENV: production
      SERVER_HOST: 0.0.0.0
      SERVER_PORT: 8080
      IMAGE_STORAGE_PATH: /data/images
    volumes:
      - ./images:/data/images
    healthcheck:
      test: ["CMD", "wget", "-q", "-T", "5", "-O", "/dev/null", "http://127.0.0.1:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s
```

**4. 启动与更新**

```bash
docker compose pull
docker compose up -d
```

更新版本时重新执行：

```bash
docker compose pull && docker compose up -d
```

应用启动时会自动执行 `server/migrations` 下的数据库迁移脚本，并检查已执行脚本的 checksum。请不要修改已发布迁移文件，新增结构变更应追加新的迁移脚本。

</details>

<details>
<summary><strong>💻 方式二：本地开发</strong></summary>

**1. 准备本地配置**

复制示例环境变量文件并填写数据库地址：

```bash
cp .env.local.example .env.local
```

至少需要配置：

```env
DATABASE_URL=postgresql://用户名:密码@127.0.0.1:5432/gpt-image
JWT_SECRET=01234567890123456789012345678901
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=Admin123456
```

**2. 安装依赖并启动后端**

```bash
npm install
npm run dev:server
```

后端默认监听 `http://localhost:8080`，会自动运行迁移并在首次启动时创建管理员账号。

**3. 启动前端开发服务**

```bash
npm run dev
```

前端开发服务默认运行在 Vite 端口，API 请求会走同源路径。若需要完整模拟生产环境，也可以直接访问后端服务端口，由后端托管构建后的 `dist/`。

**4. 构建**

```bash
npm run build
```

构建产物包括前端 `dist/` 和后端 `dist-server/`。当前版本不能只上传 `dist/` 作为完整应用运行。

</details>

<details>
<summary><strong>⚠️ 历史静态部署说明</strong></summary>

早期版本是纯前端工具，可以部署到 Vercel、GitHub Pages、Cloudflare Workers 或任意静态文件服务器。当前版本已经依赖后端接口、数据库迁移、登录态、队列和图片文件存储，因此这些方式不再适合作为正式部署方案。

如果仅用于研究旧版前端配置逻辑，仍可执行 `npm run build` 获取 `dist/`；但登录、用户管理、历史记录、队列、后台设置等功能都需要后端服务。

</details>

<details>
<summary><strong>🧪 本地故障模拟 API (可选)</strong></summary>

如果需要复现图片 URL 跨域、接口返回结构异常、原始响应查看等问题，可启动内置模拟服务：

```bash
npm run mock:api
```

使用方式见 [本地故障模拟 API](docs/mock-image-api.md)。

</details>

---

## 🛠️ 管理员初始化

服务启动后会检查数据库中是否已有未删除的管理员账号：

- 如果已存在管理员，`ADMIN_USERNAME`、`ADMIN_EMAIL`、`ADMIN_PASSWORD` 不会覆盖现有账号。
- 如果不存在管理员，且配置了 `ADMIN_PASSWORD`，系统会创建一个管理员账号，并写入初始钱包。
- 出于安全考虑，前端不提供创建管理员入口；新增管理员请通过数据库手动调整角色。

首次登录后建议立即修改默认密码，并在管理控制台配置系统名称、注册开关、默认 Credits、默认倍率、队列并发和模型服务。

---

## 🛠️ URL 传参快速填充

应用支持通过 URL 查询参数快速填入配置，非常适合创建书签或集成分享。根据你的服务商类型，选择对应的方式：

**方式一：标准 OpenAI 兼容服务商**
直接使用简短的查询参数配置：
- `?apiUrl=https://你的代理地址.com`
- `?apiKey=sk-xxxx`
- `?apiMode=images` 或 `?apiMode=responses`（未传时默认为 `images`）
- `?model=gpt-image-2`（未传时按 `apiMode` 使用默认模型）
- `?codexCli=true`（开启 Codex CLI 兼容模式）

例如，集成到 New API 的聊天系统：

```text
https://your-domain.example?apiUrl={address}&apiKey={key}&model={model}
```

**方式二：自定义格式服务商**
如果需要导入自定义格式的 API 配置，请使用 `settings` 参数并传入 URL 编码后的完整 JSON：
- `?settings={URL编码后的JSON}`（只读取 `customProviders` 和 `profiles` 列表）

> 推荐先在项目内完成配置生成与导入：
>
> **设置 - API 配置 - 服务商类型 - 创建自定义服务商 - AI 一键生成与导入**
>
> 完成后可在 **API 配置 - 当前配置** 使用右侧快捷按钮：
>
> - **链接按钮**：复制可导入配置的 URL。复制时可选择不包含 API Key，并使用 `{address}`、`{key}`、`{model}` 等变量，便于在 New API 等平台中集成分享。
> - **复制按钮**：将当前配置复制一份到配置列表底部，新配置名称会追加“（复制）”。

JSON 结构示例：

```json
{
  "customProviders": [
    {
      "id": "custom-example-task",
      "name": "示例异步任务服务商",
      "submit": {
        "path": "images/generations",
        "method": "POST",
        "contentType": "json",
        "body": {
          "model": "$profile.model",
          "prompt": "$prompt",
          "size": "$params.size",
          "quality": "$params.quality",
          "output_format": "$params.output_format",
          "output_compression": "$params.output_compression",
          "n": "$params.n",
          "image_urls": "$inputImages.dataUrls"
        },
        "taskIdPath": "data.0.task_id"
      },
      "poll": {
        "path": "tasks/{task_id}",
        "method": "GET",
        "intervalSeconds": 5,
        "statusPath": "data.status",
        "successValues": ["completed"],
        "failureValues": ["failed", "cancelled"],
        "errorPath": "data.error.message",
        "result": {
          "imageUrlPaths": ["data.result.images.*.url.*"],
          "b64JsonPaths": []
        }
      }
    }
  ],
  "profiles": [
    {
      "name": "示例异步任务服务商",
      "provider": "custom-example-task",
      "baseUrl": "https://api.example.com/v1",
      "model": "example-image-model",
      "apiMode": "images"
    }
  ]
}
```

第三方服务商可以参考 [自定义服务商 LLM 提示词](docs/custom-provider-llm-prompt.md)，让 LLM 根据自己的 API 文档生成可导入的完整配置。导入后只需要在设置里补充 API Key。

---

## 💻 技术栈

<div align="center">
  <br>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React 19" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://vite.dev/"><img src="https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E" alt="Vite" /></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind_CSS_3-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS 3" /></a>
  <a href="https://zustand.docs.pmnd.rs/"><img src="https://img.shields.io/badge/Zustand-764ABC?style=for-the-badge&logo=react&logoColor=white" alt="Zustand" /></a>
  <br>
  <br>
</div>

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。

## ⭐ Star History

<div align="center">
  <a href="https://www.star-history.com/#CookSleep/gpt_image_playground&Date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=CookSleep/gpt_image_playground&type=Date&theme=dark" />
      <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=CookSleep/gpt_image_playground&type=Date" />
      <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=CookSleep/gpt_image_playground&type=Date" />
    </picture>
  </a>
</div>
