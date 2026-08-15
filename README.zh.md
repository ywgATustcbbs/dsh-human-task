# human-task（人工协作 / Human-in-the-loop）DSH 插件

> **一切皆插件——你也是。**

把「现实世界中的用户」当作传感器和执行者的 DeepSeek Harness 插件：Agent 负责分析、推理与决策，用户负责实际操作、视觉观察和主观判断，反馈以结构化 JSON 返回。

> [English](README.md) | 中文

## 应用场景

在自动化无法可靠完成、且人的现实观察或操作能实质推进任务时使用，典型包括：

- **GUI 操作**：操作只能通过本机图形界面使用的软件。
- **游戏测试**：观察游戏画面、动画、手感等主观体验。
- **视觉验证**：确认渲染效果、界面布局、颜色显示是否符合预期。
- **环境检查**：查看真实环境状态，如设备指示灯、物理连接、现场情况。
- **硬件测试**：通电、插拔、按键、屏幕等需要实物的操作。
- **模糊体验评价**：收集可用性、易读性等主观判断。
- **调试辅助**：在需要人工观察才能定位问题的调试步骤中提供反馈。
- **受控交付**：让用户在受控范围内提供实际输出、文件路径或命令结果。

不用于普通推理、可自动化检查，或把高风险责任转嫁给用户。

## 目录结构

```text
dsh-human-task/
├─ plugin/                      动态插件半（用 cordis_define 装载，进程内临时）
│  ├─ host.js                   Host 半（human_task / human_task_ready_check 工具 + human-task 技能 + RPC）
│  └─ client.js                 Client 半（在 shell.overlay 渲染 同意 / AFK / 任务 三套对话框）
├─ packages/                    持久化（重启不丢）npm 包源码 —— 在 harness 源码工作区构建
│  ├─ dsh-human-task/           Host：ctx.humanTasks 服务 + @Remote 面 + 状态机
│  ├─ dsh-human-task-tools/     Agent preset：human_task / human_task_ready_check 工具 + human-task 技能
│  └─ dsh-human-task-client/    Host(web)：shell.overlay 对话框，自挂 Remote 面
├─ install/cordis.patch.yml     用户 patch 配方（insert 服务行 + 客户端行）—— 安装入口
├─ preset/human-task/           Agent Preset（agent.cordis.yml + preset.yml），承载工具 + 技能
├─ INSTALL.md                   全新用户 / 安装 agent 指南（下载产物 + patch + preset）
├─ BUILDING.md                  作者 / CI 构建指南（harness 源码工作区）
├─ README.md                    英文版
├─ README.zh.md                 本文件（中文版）
└─ temp/                        原始移植包（已从 git 排除）
```

两条装载路径：

- **动态（零构建）**：把 `plugin/host.js` + `plugin/client.js` 传给 `cordis_define` / `cordis_run`。进程内临时，重启即丢。
- **持久化（Option B）**：先构建三个包一次（BUILDING.md），全新用户的 agent 安装「已构建的包 + `install/cordis.patch.yml` + `preset/human-task/`」（INSTALL.md）。每次启动自动预加载、弹窗可用，无需重打包 web、无需改 `dsh-api-remotes`。

## 能力

- **结构化输入**：`instructions` 为 JSON 字符串数组（每项一步、逐字保留），或用单个 `task` 对象传入整份任务；不做任何分隔符拆分，长文本不会被截断。
- **两级门控**：会话同意（首调用弹窗，无响应默认拒绝）+ AFK 在场检测（每小时最多一次）；「拒绝后续所有协助」全局生效；单实例（`busy`）。
- **任务窗**：标题 / 步骤 / 成功条件 / 反馈要求 / 倒计时 / 多行反馈框；六个操作：完成 / 部分失败 / 失败 / 取消 / 延长时间（下拉 5/10/15 分钟，累加）/ 拒绝后续所有协助。
- **结果状态**：`success / partial / failed / cancelled / timeout / error / denied`（门控另有 `ready / granted / present / afk`）。
- **预置提示音**：每个新弹窗播放 `assets/notification.wav`（构建时内联进浏览器 bundle，随 client 包分发，无需额外文件）；解码失败时回退到合成振荡器「叮」；可静音（持久化）。
- **跟随 Harness**：对话框文字按 Harness 语言选项中英切换；配色按 Harness 主题亮/暗切换（暗色下更深背景、按钮统一深色）。

## 装载为动态插件

`plugin/host.js` 与 `plugin/client.js` 分别是 `cordis_define` 所需的 `code.host` / `code.client` 函数体。用 `cordis_define`（`kind: "new"`）传入这两段文本，再 `cordis_run` 即可。

## 重要说明：动态插件是进程内临时的

动态插件与它的定义只存在于当前 DSH 进程，**进程重启即丢失**（不会写入磁盘）。如需长期可用、重启不丢，请把它固化为磁盘上的 **Agent Preset 组合**（`${DSH_HOME}/.agent-presets/<id>/cordis.yml` 里挂 host + client 两行插件）。
