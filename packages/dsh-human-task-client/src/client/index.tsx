/**
 * Web human-task plugin, browser half.
 *
 * Renders the consent / AFK / task dialogs in `shell.overlay` and drives the
 * host `ctx.humanTasks` Remote face (`poll` / `submit` / `getMute` / `setMute`).
 * Reads the Harness locale (zh/en) and theme (light/dark) at runtime, and plays
 * a synthesized "ding" on each new dialog with a persisted mute toggle.
 *
 * This file is the Client tsdown bundle entry (`./client` export). It uses JSX;
 * the build compiles it to the `window.__ModuleLoader__` browser format.
 *
 * @module @deepseek-ai/dsh-human-task-client/client
 */
import React from "react";
// Generated Host Remote contribution (Typert codegen). Self-mounted below so the
// client package needs NO entry in the shipped `dsh-api-remotes` assembly — this
// is the key that makes the whole plugin installable via a user `cordis.patch.yml`.
import humanTasksRemote from "@deepseek-ai/dsh-human-task/remote";

const name = "human-task-client";
const inject = ["remote", "slots", "locale", "theme"];

const T: { zh: Record<string, string>; en: Record<string, string> } = {
  zh: {
    consentTitle: "Agent 请求人工协助",
    consentQuestion: "是否同意在本会话中接收人工协助请求？",
    consentHint: "无响应将默认拒绝。",
    agree: "同意",
    decline: "拒绝",
    denyAll: "拒绝后续所有协助",
    afkTitle: "AFK 检查",
    afkQuestion: "你还在吗？",
    afkHint: "如果没有响应，将认为你暂时离开 (AFK)。",
    present: "在（继续）",
    taskTitle: "人工任务 (Human Task)",
    titlePrefix: "标题: ",
    instructionsLabel: "请执行 (Instructions)",
    successPrefix: "成功条件: ",
    feedbackPrefix: "反馈要求: ",
    defaultCondition: "完成后请输入结果；如果失败，请描述问题。",
    feedbackLabel: "反馈 (Feedback)",
    placeholder: "输入结果或失败描述…",
    done: "完成 (成功)",
    partial: "部分失败",
    failed: "失败",
    cancel: "取消",
    extend: "延长时间",
    extend5: "延长 5 分钟",
    extend10: "延长 10 分钟",
    extend15: "延长 15 分钟",
    timerPrefix: "剩余时间: ",
    close: "关闭",
    noInstructions: "（无具体步骤）",
    fbSuccess: "完成",
    fbPartial: "部分完成",
    fbFailed: "失败",
    mute: "静音",
    unmute: "取消静音",
  },
  en: {
    consentTitle: "Agent requests human assistance",
    consentQuestion: "Allow human-assistance requests in this session?",
    consentHint: "No response will be treated as a refusal.",
    agree: "Agree",
    decline: "Decline",
    denyAll: "Decline all future assistance",
    afkTitle: "AFK check",
    afkQuestion: "Are you still there?",
    afkHint: "No response will be treated as away (AFK).",
    present: "Still here (continue)",
    taskTitle: "Human Task",
    titlePrefix: "Title: ",
    instructionsLabel: "Instructions",
    successPrefix: "Success condition: ",
    feedbackPrefix: "Feedback request: ",
    defaultCondition: "Enter the result when done; if it failed, describe the problem.",
    feedbackLabel: "Feedback",
    placeholder: "Enter the result or a failure description…",
    done: "Done (success)",
    partial: "Partial failure",
    failed: "Failed",
    cancel: "Cancel",
    extend: "Extend time",
    extend5: "Extend 5 min",
    extend10: "Extend 10 min",
    extend15: "Extend 15 min",
    timerPrefix: "Time remaining: ",
    close: "Close",
    noInstructions: "(No specific steps)",
    fbSuccess: "Done",
    fbPartial: "Partially completed",
    fbFailed: "Failed",
    mute: "Mute",
    unmute: "Unmute",
  },
};

function t(lang: string, key: string): string {
  const dict = lang === "en" ? T.en : T.zh;
  if (dict[key] !== undefined) return dict[key];
  if (T.zh[key] !== undefined) return T.zh[key];
  return key;
}

function defaultFeedback(lang: string, action: string): string {
  if (action === "success") return t(lang, "fbSuccess");
  if (action === "partial") return t(lang, "fbPartial");
  if (action === "failed") return t(lang, "fbFailed");
  return "";
}

function makeStyles(dark: boolean) {
  const c = dark
    ? {
        overlay: "#171a1f",
        layer1: "#21252c",
        labelPrimary: "#e6e8eb",
        labelSecondary: "#9aa0a6",
        borderL1: "#2c313a",
        borderL2: "#3b424c",
        primaryBg: "#1f3a5f",
        primaryText: "#e8f1ff",
        primaryBorder: "#2f5279",
        error: "#ff8080",
        warn: "#ffc069",
      }
    : {
        overlay: "#ffffff",
        layer1: "#f6f8fa",
        labelPrimary: "#1f2328",
        labelSecondary: "#57606a",
        borderL1: "#e5e7eb",
        borderL2: "#d1d5db",
        primaryBg: "#2563eb",
        primaryText: "#ffffff",
        primaryBorder: "#2563eb",
        error: "#b91c1c",
        warn: "#b45309",
      };
  return {
    backdrop: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, pointerEvents: "auto", padding: 12 } as React.CSSProperties,
    card: { background: c.overlay, color: c.labelPrimary, borderRadius: 12, width: 620, maxWidth: "96vw", maxHeight: "92vh", overflow: "auto", boxShadow: "0 10px 48px rgba(0,0,0,0.45)", fontFamily: 'system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif', display: "flex", flexDirection: "column" } as React.CSSProperties,
    header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid " + c.borderL1 } as React.CSSProperties,
    headerTitle: { fontSize: 16, fontWeight: 700, margin: 0 } as React.CSSProperties,
    headerRight: { display: "flex", alignItems: "center", gap: 2 } as React.CSSProperties,
    close: { border: "none", background: "transparent", fontSize: 22, lineHeight: 1, cursor: "pointer", color: c.labelSecondary, padding: "4px 8px" } as React.CSSProperties,
    muteBtn: { border: "none", background: "transparent", fontSize: 16, lineHeight: 1, cursor: "pointer", color: c.labelSecondary, padding: "4px 8px" } as React.CSSProperties,
    body: { padding: "16px 18px" } as React.CSSProperties,
    sectionTitle: { fontSize: 13, fontWeight: 700, color: c.labelPrimary, margin: "0 0 6px" } as React.CSSProperties,
    pre: { whiteSpace: "pre-wrap", wordBreak: "break-word", background: c.layer1, border: "1px solid " + c.borderL1, borderRadius: 8, padding: 10, margin: "0 0 12px", fontSize: 13, maxHeight: 220, overflow: "auto", color: c.labelPrimary } as React.CSSProperties,
    cond: { whiteSpace: "pre-wrap", fontSize: 13, color: c.labelSecondary, margin: "0 0 12px" } as React.CSSProperties,
    timer: { fontSize: 14, fontWeight: 700, color: c.error, margin: "0 0 10px" } as React.CSSProperties,
    textarea: { width: "100%", minHeight: 110, boxSizing: "border-box", resize: "vertical", border: "1px solid " + c.borderL2, borderRadius: 8, padding: 8, fontSize: 13, fontFamily: "inherit", background: c.layer1, color: c.labelPrimary } as React.CSSProperties,
    row: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 } as React.CSSProperties,
    btn: { border: "1px solid " + c.borderL2, background: c.layer1, color: c.labelPrimary, borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 13 } as React.CSSProperties,
    primary: { border: "1px solid " + c.primaryBorder, background: c.primaryBg, color: c.primaryText, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13 } as React.CSSProperties,
    warn: { border: "1px solid " + c.error, background: "transparent", color: c.error, borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 13 } as React.CSSProperties,
    select: { border: "1px solid " + c.warn, background: c.layer1, color: c.warn, borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 13 } as React.CSSProperties,
    msg: { fontSize: 14, lineHeight: 1.6 } as React.CSSProperties,
  };
}

function fmtClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return (m < 10 ? "0" : "") + m + ":" + (sec < 10 ? "0" : "") + sec;
}

async function apply(ctx: any) {
  // Self-mount the host Remote face: after this settles, `remote.humanTasks` is a
  // live namespace service (its disposer is owned by this plugin's fiber via
  // `$mount`'s internal `effect`). Injecting `remote.humanTasks` up front would
  // deadlock (this plugin is the one that mounts it), so it is fetched lazily.
  await ctx.remote.$mount(humanTasksRemote);
  const slots = ctx.slots;
  const remote = ctx.get("remote.humanTasks");
  const h = React.createElement;

  // ── synthesized "ding" (Web Audio) with per-instance dedup ────────────────
  const gRoot: any = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : {};
  const g = (gRoot.__humanTaskAudio = gRoot.__humanTaskAudio || {});
  g.instances = (g.instances || 0) + 1;

  function beep() {
    const nowTs = Date.now();
    if (nowTs - (g.lastBeepAt || 0) < 500) return;
    g.lastBeepAt = nowTs;
    try {
      const AC: any = typeof AudioContext !== "undefined" ? AudioContext : typeof (window as any).webkitAudioContext !== "undefined" ? (window as any).webkitAudioContext : null;
      if (!AC) return;
      if (!g.audioCtx) g.audioCtx = new AC();
      const play = () => {
        const now = g.audioCtx.currentTime;
        const osc = g.audioCtx.createOscillator();
        const gain = g.audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.4, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        osc.connect(gain);
        gain.connect(g.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
      };
      if (g.audioCtx.state === "suspended") g.audioCtx.resume().then(play).catch(() => {});
      else play();
    } catch {
      /* noop */
    }
  }

  ctx.effect(() => () => {
    g.instances = Math.max(0, (g.instances || 1) - 1);
    if (g.instances === 0) {
      if (g.audioCtx) {
        try {
          g.audioCtx.close();
        } catch {
          /* noop */
        }
      }
      g.audioCtx = null;
      g.lastBeepAt = 0;
      g.lastBeepedId = null;
    }
  });

  function useLang() {
    const locale = ctx.locale;
    const readLang = () => {
      if (!locale) return "zh";
      try {
        const snap = typeof locale.getSnapshot === "function" ? locale.getSnapshot() : typeof locale.getLocale === "function" ? locale.getLocale() : null;
        return snap && snap.active === "en" ? "en" : "zh";
      } catch {
        return "zh";
      }
    };
    const [lang, setLang] = React.useState(readLang);
    React.useEffect(() => {
      if (!locale || typeof locale.subscribe !== "function") return;
      return locale.subscribe(() => setLang(readLang()));
    }, []);
    return lang;
  }

  function useTheme() {
    const theme = ctx.theme;
    const readDark = () => {
      if (!theme) return false;
      try {
        const snap = theme.getTheme();
        return !!(snap && snap.active && snap.active.colorScheme === "dark");
      } catch {
        return false;
      }
    };
    const [dark, setDark] = React.useState(readDark);
    React.useEffect(() => {
      return ctx.on("theme/change", (snap: any) => {
        setDark(!!(snap && snap.active && snap.active.colorScheme === "dark"));
      });
    }, []);
    return dark;
  }

  function useCountdown(deadlineAt: number, onExpire: () => void) {
    const [remaining, setRemaining] = React.useState(() => Math.max(0, Math.round((deadlineAt - Date.now()) / 1000)));
    const onExpireRef = React.useRef(onExpire);
    onExpireRef.current = onExpire;
    const firedRef = React.useRef(false);
    React.useEffect(() => {
      firedRef.current = false;
      const cancel = window.setInterval(() => {
        const rem = Math.max(0, Math.round((deadlineAt - Date.now()) / 1000));
        setRemaining(rem);
        if (rem <= 0 && !firedRef.current) {
          firedRef.current = true;
          onExpireRef.current();
        }
      }, 1000);
      return () => window.clearInterval(cancel);
    }, [deadlineAt]);
    return remaining;
  }

  function submit(interaction: any, action: string, feedback: string, extra?: Record<string, unknown>) {
    return remote.submit(Object.assign({ id: interaction.id, action, feedback: feedback || "" }, extra || {}));
  }

  function MuteButton(props: any) {
    const muted = props.muted;
    const lang = props.lang;
    const S = props.S;
    const label = muted ? t(lang, "unmute") : t(lang, "mute");
    return h(
      "button",
      { style: S.muteBtn, onClick: props.onToggleMute, "aria-label": label, title: label },
      muted ? "🔇" : "🔊",
    );
  }

  function ConsentDialog(props: any) {
    const it = props.interaction;
    const lang = props.lang;
    const S = props.S;
    const remaining = useCountdown(it.deadlineAt, () => submit(it, "timeout", ""));
    return h(
      "div",
      { style: S.backdrop },
      h(
        "div",
        { style: S.card },
        h(
          "div",
          { style: S.header },
          h("div", { style: S.headerTitle }, t(lang, "consentTitle")),
          h(
            "div",
            { style: S.headerRight },
            h(MuteButton, { muted: props.muted, lang, S, onToggleMute: props.onToggleMute }),
            h("button", { style: S.close, onClick: () => submit(it, "window_closed", ""), "aria-label": t(lang, "close") }, "×"),
          ),
        ),
        h(
          "div",
          { style: S.body },
          h("p", { style: S.msg }, t(lang, "consentQuestion")),
          h("p", { style: S.msg }, t(lang, "consentHint")),
          h("div", { style: S.timer }, t(lang, "timerPrefix") + fmtClock(remaining)),
          h(
            "div",
            { style: S.row },
            h("button", { style: S.primary, onClick: () => submit(it, "granted", "") }, t(lang, "agree")),
            h("button", { style: S.btn, onClick: () => submit(it, "declined", "") }, t(lang, "decline")),
            h("button", { style: S.warn, onClick: () => submit(it, "deny_all", "") }, t(lang, "denyAll")),
          ),
        ),
      ),
    );
  }

  function AfkDialog(props: any) {
    const it = props.interaction;
    const lang = props.lang;
    const S = props.S;
    const remaining = useCountdown(it.deadlineAt, () => submit(it, "timeout", ""));
    return h(
      "div",
      { style: S.backdrop },
      h(
        "div",
        { style: S.card },
        h(
          "div",
          { style: S.header },
          h("div", { style: S.headerTitle }, t(lang, "afkTitle")),
          h(
            "div",
            { style: S.headerRight },
            h(MuteButton, { muted: props.muted, lang, S, onToggleMute: props.onToggleMute }),
            h("button", { style: S.close, onClick: () => submit(it, "window_closed", ""), "aria-label": t(lang, "close") }, "×"),
          ),
        ),
        h(
          "div",
          { style: S.body },
          h("p", { style: S.msg }, t(lang, "afkQuestion")),
          h("p", { style: S.msg }, t(lang, "afkHint")),
          h("div", { style: S.timer }, t(lang, "timerPrefix") + fmtClock(remaining)),
          h(
            "div",
            { style: S.row },
            h("button", { style: S.primary, onClick: () => submit(it, "present", "") }, t(lang, "present")),
            h("button", { style: S.warn, onClick: () => submit(it, "deny_all", "") }, t(lang, "denyAll")),
          ),
        ),
      ),
    );
  }

  function TaskDialog(props: any) {
    const it = props.interaction;
    const lang = props.lang;
    const S = props.S;
    const f = it.fields || {};
    const [deadlineAt, setDeadlineAt] = React.useState(it.deadlineAt);
    const [feedback, setFeedback] = React.useState("");
    const [extendValue, setExtendValue] = React.useState("");
    const doSubmit = (action: string) => {
      const fb = feedback.trim();
      const finalFb = fb.length > 0 ? feedback : defaultFeedback(lang, action);
      submit(it, action, finalFb);
    };
    const remaining = useCountdown(deadlineAt, () => doSubmit("timeout"));

    const inst = Array.isArray(f.instructions) ? f.instructions : [];
    const instText = inst.length === 0 ? t(lang, "noInstructions") : inst.map((s: string, i: number) => i + 1 + ". " + s).join("\n");
    let cond = "";
    if (f.success_condition) cond += t(lang, "successPrefix") + f.success_condition;
    if (f.feedback_request) {
      if (cond) cond += "\n";
      cond += t(lang, "feedbackPrefix") + f.feedback_request;
    }
    if (!cond) cond = t(lang, "defaultCondition");

    const onExtend = (minutes: number) => {
      submit(it, "extend", "", { minutes }).then((r: any) => {
        if (r && r.ok && typeof r.deadlineAt === "number") setDeadlineAt(r.deadlineAt);
      });
    };

    return h(
      "div",
      { style: S.backdrop },
      h(
        "div",
        { style: S.card },
        h(
          "div",
          { style: S.header },
          h("div", { style: S.headerTitle }, t(lang, "taskTitle")),
          h(
            "div",
            { style: S.headerRight },
            h(MuteButton, { muted: props.muted, lang, S, onToggleMute: props.onToggleMute }),
            h("button", { style: S.close, onClick: () => doSubmit("window_closed"), "aria-label": t(lang, "close") }, "×"),
          ),
        ),
        h(
          "div",
          { style: S.body },
          h("div", { style: { fontSize: 15, fontWeight: 700, marginBottom: 12 } }, t(lang, "titlePrefix") + String(f.title || "")),
          h("div", { style: S.sectionTitle }, t(lang, "instructionsLabel")),
          h("pre", { style: S.pre }, instText),
          h("pre", { style: S.cond }, cond),
          h("div", { style: S.timer }, t(lang, "timerPrefix") + fmtClock(remaining)),
          h("div", { style: S.sectionTitle }, t(lang, "feedbackLabel")),
          h("textarea", { style: S.textarea, value: feedback, onChange: (e: any) => setFeedback(e.target.value), placeholder: t(lang, "placeholder") }),
          h(
            "div",
            { style: S.row },
            h("button", { style: S.primary, onClick: () => doSubmit("success") }, t(lang, "done")),
            h("button", { style: S.btn, onClick: () => doSubmit("partial") }, t(lang, "partial")),
            h("button", { style: S.btn, onClick: () => doSubmit("failed") }, t(lang, "failed")),
            h("button", { style: S.btn, onClick: () => doSubmit("cancelled") }, t(lang, "cancel")),
            h(
              "select",
              {
                value: extendValue,
                onChange: (e: any) => {
                  const v = e.target.value;
                  setExtendValue("");
                  if (v) onExtend(parseInt(v, 10));
                },
                style: S.select,
              },
              h("option", { value: "", disabled: true }, t(lang, "extend")),
              h("option", { value: "5" }, t(lang, "extend5")),
              h("option", { value: "10" }, t(lang, "extend10")),
              h("option", { value: "15" }, t(lang, "extend15")),
            ),
            h("button", { style: S.warn, onClick: () => doSubmit("deny_all") }, t(lang, "denyAll")),
          ),
        ),
      ),
    );
  }

  function HumanTaskOverlay() {
    const lang = useLang();
    const dark = useTheme();
    const S = makeStyles(dark);
    const [interaction, setInteraction] = React.useState<any>(null);
    const [muted, setMuted] = React.useState(false);

    React.useEffect(() => {
      remote.getMute().then((r: any) => {
        if (r && typeof r.muted === "boolean") setMuted(r.muted);
      }).catch(() => {});
    }, []);

    React.useEffect(() => {
      let stopped = false;
      let polling = false;
      async function tick() {
        if (polling) return;
        polling = true;
        try {
          const cur = await remote.poll();
          if (stopped) return;
          if (cur) {
            setInteraction(cur.interaction || null);
            if (typeof cur.muted === "boolean") setMuted(cur.muted);
          } else {
            setInteraction(null);
          }
        } catch {
          /* noop */
        } finally {
          polling = false;
        }
      }
      tick();
      const cancel = window.setInterval(tick, 900);
      return () => {
        stopped = true;
        window.clearInterval(cancel);
      };
    }, []);

    React.useEffect(() => {
      if (!interaction || interaction.id === g.lastBeepedId) return;
      g.lastBeepedId = interaction.id;
      if (muted) return;
      beep();
    }, [interaction, muted]);

    const toggleMute = () => {
      const next = !muted;
      setMuted(next);
      remote.setMute({ muted: next }).catch(() => {});
    };

    let dialog = null;
    if (interaction) {
      if (interaction.kind === "consent") dialog = h(ConsentDialog, { interaction, lang, S, muted, onToggleMute: toggleMute });
      else if (interaction.kind === "afk") dialog = h(AfkDialog, { interaction, lang, S, muted, onToggleMute: toggleMute });
      else if (interaction.kind === "task") dialog = h(TaskDialog, { interaction, lang, S, muted, onToggleMute: toggleMute });
    }

    return dialog;
  }

  slots.inject("shell.overlay", () => slots.register({ name: "shell.overlay", id: "human-task-overlay", order: 1000 }, () => h(HumanTaskOverlay)));
}

export { apply, inject, name };
