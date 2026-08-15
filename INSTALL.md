# 安装（全新用户 / 安装 agent 路径）

目标：用户装好官方 harness 后，**给 agent 一个 GitHub 地址**，agent 把插件装上；之后每次启动 harness 都自动预加载，agent 能发现并使用 `human_task`/`human_task_ready_check` 工具与 `human-task` 技能，用户能看到弹窗。

> 前置：这里的产物必须是**已构建**的（见 [BUILDING.md](BUILDING.md)）。release 里应包含：三个 `.tgz`、`install/cordis.patch.yml`、`preset/human-task/`。

## agent 安装步骤（幂等、可脚本化）

### 1. 下载 release 资产

```text
deepseek-ai-dsh-human-task-0.1.0.tgz          # 宿主服务（ctx.humanTasks + Remote 面）
deepseek-ai-dsh-human-task-tools-0.1.0.tgz    # 工具 + 技能（进 preset）
deepseek-ai-dsh-human-task-client-0.1.0.tgz   # 浏览器弹窗（shell.overlay）
install/cordis.patch.yml
preset/human-task/
```

### 2. 把三个包装进 profile 依赖

harness 的 profile 位于 `$DSH_HOME/profiles/<name>/`（`$DSH_HOME` 默认 `~/.dsh`）。用默认的 `web` profile 即可：

```bash
# 方式 A：在 profile 目录里解包并记入 package.json dependencies
cd "$DSH_HOME/profiles/web"
npm install ./deepseek-ai-dsh-human-task-0.1.0.tgz \
            ./deepseek-ai-dsh-human-task-tools-0.1.0.tgz \
            ./deepseek-ai-dsh-human-task-client-0.1.0.tgz

# 方式 B：手动放到 flat 目录（healProfilesModuleFallback 维护的那一层）
mkdir -p "$DSH_HOME/profiles/node_modules/@deepseek-ai"
tar -xzf deepseek-ai-dsh-human-task-0.1.0.tgz       -C "$DSH_HOME/profiles/node_modules/@deepseek-ai" && mv .../package dsh-human-task
# （human-task-tools、human-task-client 同理）
```

> 注：profile 的 `package.json`（树外插件依赖）+ `healProfilesModuleFallback` 的 flat `node_modules` 是 harness 的官方扩展面；两种方式最终都让 patch 里的裸包名 `@deepseek-ai/dsh-human-task` 等可解析。若 deployment 改了 profile 机制，以 `dsh-app-boot` 文档为准。

### 3. 写入 patch 层

把 `install/cordis.patch.yml` 的内容并入 home 级 patch（对所有 profile 生效）：

```bash
# 首次：直接复制
cp install/cordis.patch.yml "$DSH_HOME/cordis.patch.yml"

# 已存在：把文件里的 `- insert:` 那段 merge 进现有数组（不要覆盖其他条目）
```

（也可以只写入 `$DSH_HOME/profiles/web/cordis.patch.yml`，作用域更小。）

patch 会 `insert` 两行：`human-task`（宿主服务）与 `human-task-client`（浏览器弹窗）。`dsh-client-modules` 会在最终组合里扫描到 `dsh.client` 行并在运行时下发其浏览器 bundle；客户端 bundle 自挂 `remote.humanTasks` Remote 面——**无需改任何 shipped 文件、无需重打包 web**。

### 4. 安装 preset（工具 + 技能）

```bash
mkdir -p "$DSH_HOME/.agent-presets/human-task"
cp -r preset/human-task/* "$DSH_HOME/.agent-presets/human-task/"
```

### 5. 设为默认 preset

任选其一：

- UI：设置 → General → Agent Preset，选择 `human-task`；
- 或写 settings：`agent-presets.default = human-task`（settings 命名空间，见 `dsh-agent-presets` 文档）。

### 6. 重启 harness

patch 层有热监视（`watchUserPatches`），但为干净起见重启一次。启动后：

- 新会话默认 preset 为 `human-task` → 自动加载 `human_task`/`human_task_ready_check` 工具 + `human-task` 技能；
- 宿主侧 `ctx.humanTasks` 与浏览器弹窗已随 patch 预加载。

## 验证

1. 设置里能看到并选中 `human-task` preset，且被记为默认。
2. 让 agent 调 `human_task`（或 `human_task_ready_check`）：应弹出「同意」对话框，同意后出现任务对话框，六个操作 + 倒计时正常。
3. 弹窗出现时播放预置提示音（`assets/notification.wav`，已内联进 client 包，无需额外分发）；静音按钮可关闭并持久化。
4. 重启 harness 后无需任何手动动作，插件仍在（真·预加载，非动态加载）。

## 与动态插件的关系

`plugin/host.js`+`plugin/client.js` 仍是零构建的动态加载备选（进程内临时）。本路径产出的 preset + patch 是持久化形态；两者共享同一套工具/技能语义，只有装载机制不同。
