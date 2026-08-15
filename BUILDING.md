# 构建（作者 / CI 路径）

把 `human-task` 打包成**可分发的预构建产物**（三个 `.tgz`，落到 `build/`）。全新用户**不需要**做这些——他们只跑 `dsh plugin add dsh-human-task`，见 [INSTALL.md](INSTALL.md)。

## 为什么必须在 harness 源码工作区构建

Typert 的 `/remote` 代码生成器（`@deepseek-ai/dsh-typert-generator`）**把包注册硬编码为只扫描 `<root>/packages/` 下的项目**。而 `@Remote` 装饰器要能被识别，必须把 `@deepseek-ai/dsh-typert-protocol` 解析为**工作区内的包**（`isTypeMetaSymbol` 靠 `registrationForFile(...).name === "@deepseek-ai/dsh-typert-protocol"` 判定）。

在**独立 npm 构建**里，`dsh-typert-protocol` 是 `node_modules` 依赖、不在 `<root>/packages/` 下，于是：

- ✅ `tsc` 编译三个包源码 —— 通过；
- ✅ Typert 通过 `Context` 增强（`interface Context { humanTasks }`）**发现服务** —— 通过；
- ❌ Typert 识别 `@Remote` 方法 —— 失败（`publishes Remote artifacts but has no Remote methods`）。

所以完整构建（生成 `/remote` 面与客户端 bundle）**只能发生在 harness 源码工作区**。本仓库的构建脚本 `scripts/harness-build.mjs` 会自动 checkout/定位 harness 源码、把三个包复制进去、改写成工作区约定并构建打包。

## 一条命令构建

```bash
# 先 clone harness 源码（一次性）
git clone --depth 1 https://github.com/deepseek-ai/deepseek-harness.git ../deepseek-harness

# 构建 + 打包（内部会 pnpm install、build:lib:host、build:lib:client、pack）
node scripts/harness-build.mjs ../deepseek-harness
```

产物落到 `build/`：

```text
dsh-human-task-0.1.1.tgz         # 宿主服务（ctx.humanTasks + Remote 面）+ dsh.bundle + cordis.patch.yml
dsh-human-task-tools-0.1.1.tgz   # 工具 + 技能（全局注册）
dsh-human-task-client-0.1.1.tgz  # 浏览器弹窗（shell.overlay）
```

脚本做的转换（`packages/dsh-human-task*` → harness 工作区）：

0. 运行 `scripts/embed-sound.mjs`：把 `assets/notification.wav` 编码为 base64，生成 `packages/dsh-human-task-client/src/client/sound.ts`（生成文件，已 gitignore）。
1. 复制到 `packages/interaction/{human-task,human-task-tools,human-task-client}`（按 harness 约定去掉 `dsh-` 前缀，让 `paths` 通配符命中目录约定）。
2. 重写每个 `package.json`：依赖改成 `workspace:^`、`main`/`types`/`exports`/`files` 改为 `lib/types` 布局（与 `dsh-goal` 同构）；宿主包额外写入 `dsh.bundle.patch`、`dependencies`（tools + client）并把 `cordis.patch.yml` 纳入 `files`。
3. 重写每个 `tsconfig.json`：`extends ../../../tsconfig.base(.client).json`、`outDir: lib/types`、补齐 project references。
4. 给 client 包写 `tsdown.config.ts`（`clientBundle` 预设）。
5. 在 harness 的 `tsconfig.host.json` / `tsconfig.client.json` 注册 references。

`pnpm pack` 会把 `workspace:^` 重写为具体版本（`^0.1.1`），所以 `.tgz` 里的依赖是可被运行时解析的 semver 范围。

## 发布到 npm

打包后把三个包发布到 npm（裸包名，无需 scope）：

```bash
npm publish build/dsh-human-task-0.1.1.tgz
npm publish build/dsh-human-task-tools-0.1.1.tgz
npm publish build/dsh-human-task-client-0.1.1.tgz
```

之后用户即可 `dsh plugin add dsh-human-task`（见 [INSTALL.md](INSTALL.md)）。

## 已在本仓库实测验证的点

| 验证项 | 结果 |
|---|---|
| `tsc` 编译三个包源码（host + client） | ✅ |
| Typert 在 harness 工作区识别 `@Remote` 并生成 `/remote` | ✅ |
| `ctx.remote.$mount(contribution)` 是 `dsh-api-gateway` client 公开 API（自挂 Remote 面，无需改 `dsh-api-remotes`） | ✅ |
| `shell.overlay` 是真实 slot（`packages/client/ui-layout` 声明的 root 级 list slot） | ✅ |
| `dsh-client-modules` 下发 `dsh.client` 包的浏览器 bundle、`GENERATED_REMOTE` 允许内联 `/remote` | ✅（从源码确认） |
| `defineTool` 的 `parameters`/`output.schema`（`type: "json"`）/`presentCall`（`GenericCallView`）契约 | ✅ |
| `ctx.skills.register` 的 `source: "runtime"` | ✅ |
| `ctx.tools.register` 在宿主面注册即全局可见（每个 agent scope 都能解析到） | ✅（从 `packages/core/tools` 源码确认） |
| `timer` 服务（`ctx.timeout`/`ctx.interval`）在宿主面可用；浏览器面**无** `timer`，client 用 `window.setInterval` | ✅ |

## CI

`.github/workflows/build.yml`：checkout 本仓库 + `deepseek-ai/deepseek-harness` 源码，`node human-task/scripts/harness-build.mjs harness`，上传 `build/*.tgz`。
