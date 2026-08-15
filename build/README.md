# 预构建产物（`.tgz`）

此目录存放由 `scripts/harness-build.mjs`（在 DeepSeek Harness 源码工作区内）产出的三个分发包：

| 包 | 装到（新用户的 harness） |
|---|---|
| `deepseek-ai-dsh-human-task-0.1.1.tgz` | `$DSH_HOME/profiles/<name>/node_modules/@deepseek-ai/dsh-human-task/` |
| `deepseek-ai-dsh-human-task-tools-0.1.1.tgz` | `$DSH_HOME/profiles/<name>/node_modules/@deepseek-ai/dsh-human-task-tools/` |
| `deepseek-ai-dsh-human-task-client-0.1.1.tgz` | `$DSH_HOME/profiles/<name>/node_modules/@deepseek-ai/dsh-human-task-client/` |

`$DSH_HOME` 默认 `~/.dsh`；`<name>` 是 profile 名（默认 `web`）。

这三个包之外的 release 资产：

| 文件 | 复制到 |
|---|---|
| `install/cordis.patch.yml` | 并入 `$DSH_HOME/cordis.patch.yml`（或 `$DSH_HOME/profiles/<name>/cordis.patch.yml`） |
| `preset/human-task/` | `$DSH_HOME/.agent-presets/human-task/` |

完整安装流程见 [INSTALL.md](../INSTALL.md)；构建方法见 [BUILDING.md](../BUILDING.md)。

> 说明：`.tgz` 是构建产物（被 `.gitignore` 忽略）；本 `README.md` 与 `.gitkeep` 保留目录本身。
