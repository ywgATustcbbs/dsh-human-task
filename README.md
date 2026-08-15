# human-task (Human-in-the-loop) — DSH plugin

> **Everything is a plugin — and so are you.**

A DeepSeek Harness plugin that turns the real-world user into a sensor and actuator: the Agent analyzes, reasons, and decides, while the user performs physical actions, visual observation, and subjective judgment, returning structured JSON.

> [中文](README.zh.md) | English

## Application scenarios

Use it when automation cannot reliably finish the job and a human's real-world observation or action meaningfully advances it. Typical cases:

- **GUI operation** — operate software only accessible through the local graphical interface.
- **Game testing** — observe in-game visuals, animation, and feel.
- **Visual verification** — confirm rendering, layout, and color output.
- **Environment inspection** — check real-world state such as device LEDs, physical connections, and on-site conditions.
- **Hardware testing** — power, plug/unplug, key presses, screens, and other physical actions.
- **Subjective evaluation** — collect usability, readability, and other human judgments.
- **Debugging assistance** — get human observation for steps that need eyes on the screen or device.
- **Bounded delivery** — let the user provide actual output, file paths, or command results within a controlled scope.

Not for ordinary reasoning, automatable checks, or offloading high-risk responsibility to the user.

## Directory layout

```text
dsh-human-task/
├─ plugin/                      Dynamic-plugin halves (load with cordis_define, process-local)
│  ├─ host.js                   Host half (human_task / human_task_ready_check tools, human-task skill, RPC)
│  └─ client.js                 Client half (consent / AFK / task dialogs in shell.overlay)
├─ packages/                    Persistent (restart-proof) npm-package source — build in the harness workspace
│  ├─ dsh-human-task/           Host: ctx.humanTasks service + @Remote face + state machine
│  ├─ dsh-human-task-tools/     Agent preset: human_task / human_task_ready_check tools + human-task skill
│  └─ dsh-human-task-client/    Host(web): shell.overlay dialogs, self-mounts the Remote face
├─ install/cordis.patch.yml     User patch recipe (insert host service + client rows) — the install hook
├─ preset/human-task/           Agent Preset (agent.cordis.yml + preset.yml) for the tools + skill
├─ INSTALL.md                   Fresh-user / install-agent guide (download built packages + patch + preset)
├─ BUILDING.md                  Author/CI build guide (harness source workspace)
├─ README.md                    This file (English)
├─ README.zh.md                 Chinese version
└─ temp/                        Original porting kit (excluded from git)
```

Two loading paths:

- **Dynamic (zero build)**: pass `plugin/host.js` + `plugin/client.js` to `cordis_define` / `cordis_run`. Process-local, lost on restart.
- **Persistent (Option B)**: build the three packages once (BUILDING.md), then a fresh user's agent installs the built packages + `install/cordis.patch.yml` + `preset/human-task/` (INSTALL.md). Auto-loads on every boot; dialogs work; no web rebuild and no `dsh-api-remotes` edit.

## Capabilities

- **Structured input** — `instructions` is a JSON string array (one step per item, kept verbatim), or pass the whole task as a single `task` object. No delimiter splitting, so long text is never mangled.
- **Two-level gate** — session consent (first-call dialog, no response = decline) + AFK presence check (at most once per hour); "Decline all future assistance" applies globally; single instance (`busy`).
- **Task dialog** — title / steps / success condition / feedback request / countdown / multiline feedback box; six actions: Done / Partial failure / Failed / Cancel / Extend time (5/10/15 min dropdown, additive) / Decline all future assistance.
- **Result statuses** — `success / partial / failed / cancelled / timeout / error / denied` (gates additionally return `ready / granted / present / afk`).
- **Follows the Harness** — dialog text switches between Chinese and English with the Harness language option; colors follow the Harness light/dark theme (darker background and uniformly dark buttons in dark mode).

## Load as a dynamic plugin

`plugin/host.js` and `plugin/client.js` are the `code.host` / `code.client` function bodies that `cordis_define` expects. Pass both texts to `cordis_define` (`kind: "new"`), then `cordis_run`.

## Important: dynamic plugins are process-local

Dynamic plugins and their definitions live only in the current DSH process and are lost on restart (nothing is written to disk). For a persistent, restart-proof plugin, author it as an on-disk **Agent Preset** composition (`${DSH_HOME}/.agent-presets/<id>/cordis.yml` with a host and a client plugin row).
