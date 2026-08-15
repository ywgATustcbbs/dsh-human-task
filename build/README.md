# 预构建产物（`.tgz`）

此目录存放由 `scripts/harness-build.mjs`（在 DeepSeek Harness 源码工作区内）产出的三个分发包：

| 包 | 用途 |
|---|---|
| `dsh-human-task-0.1.1.tgz` | 宿主服务（`ctx.humanTasks` + Remote 面）+ `dsh.bundle` + `cordis.patch.yml` |
| `dsh-human-task-tools-0.1.1.tgz` | `human_task` / `human_task_ready_check` 工具 + `human-task` 技能（全局注册） |
| `dsh-human-task-client-0.1.1.tgz` | 浏览器弹窗（`shell.overlay`） |

发布到 npm 后，用户一条命令安装：

```sh
dsh plugin add dsh-human-task
```

完整安装流程见 [INSTALL.md](../INSTALL.md)；构建与发布方法见 [BUILDING.md](../BUILDING.md)。

> 说明：`.tgz` 是构建产物（被 `.gitignore` 忽略）；本 `README.md` 与 `.gitkeep` 保留目录本身。
