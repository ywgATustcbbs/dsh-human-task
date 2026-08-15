# 安装（全新用户 / 安装 agent 路径）

目标：装好官方 harness 后，一条命令把插件装好；之后每次启动自动预加载，agent 能发现并使用 `human_task`/`human_task_ready_check` 工具与 `human-task` 技能，用户能看到弹窗。

## 一条命令安装

```sh
dsh plugin add dsh-human-task
```

这条命令做了三件事：

1. `pnpm add dsh-human-task` 安装 bundle 包及其两个依赖（`dsh-human-task-tools`、`dsh-human-task-client`）；
2. harness 检测到 `dsh-human-task` 声明了 `dsh.bundle`，把它加入 profile 的 `dsh.profile.bundles` 层栈；
3. 启动时应用 bundle 的 `cordis.patch.yml`，insert 三行：宿主服务（`ctx.humanTasks`）、工具（`human_task` / `human_task_ready_check` + `human-task` 技能）、客户端弹窗。

工具全局注册，**无需 Agent preset**、无需改任何 shipped 文件、无需重打包 web。

## 验证

1. 开新会话（或重启 harness），让 agent 调 `human_task`（或 `human_task_ready_check`）：应弹出「同意」对话框，同意后出现任务对话框，六个操作 + 倒计时正常。
2. 弹窗出现时播放预置提示音（`assets/notification.wav`，已内联进 client 包）；静音按钮可关闭并持久化。
3. 重启 harness 后无需任何手动动作，插件仍在（真·预加载，非动态加载）。

## 前置

- 必须先发布 `dsh-human-task`、`dsh-human-task-tools`、`dsh-human-task-client` 三个包到 npm（见 [BUILDING.md](BUILDING.md)）。
- 产物是预构建的（含 `lib/`），安装不触发 `allowBuilds` 构建授权。

## 与动态插件的关系

`plugin/host.js`+`plugin/client.js` 仍是零构建的动态加载备选（进程内临时）。bundle 路径产出的持久化形态与动态插件共享同一套工具/技能语义，只有装载机制不同。
