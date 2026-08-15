/**
 * Human-in-the-loop capability seam: `ctx.humanTasks`.
 *
 * One host Service owns the consent / AFK / task state machine and the single
 * active interaction. The model-facing tools live in
 * `dsh-human-task-tools`; a Client UI package renders the dialog
 * and drives the `@Remote` methods below.
 *
 * Mirrors `@deepseek-ai/dsh-user-questions` in shape: a Service class the host
 * composition mounts, a provider-free direct Remote face, and a per-session
 * state machine keyed inside the service. Because the browser reaches this
 * service through its Remote face, the service row belongs in the HOST
 * composition (never an agent preset behind an `isolate` realm, which the
 * gateway could not see).
 *
 * @module dsh-human-task
 */
import type { Context } from "@deepseek-ai/cordis";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import type {
  GateResult,
  InteractionKind,
  InteractionSnapshot,
  MuteResult,
  SubmitRequest,
  SubmitResult,
  TaskFields,
  TaskResult,
} from "./types.js";

const AFK_INTERVAL_MS = 3600 * 1000;

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return "ht" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function numOr(v: unknown, d: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : d;
}

function normalizeInstructions(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string");
  if (typeof value === "string" && value.length > 0) return [value];
  return [];
}

interface SessionRecord {
  consent: string;
  consentTime: string;
  afkLastCheckMs: number | null;
  afkState: string;
}

interface Interaction {
  id: string;
  kind: InteractionKind;
  fields: TaskFields | undefined;
  deadlineAt: number;
  timeoutSeconds: number;
  resolve: (payload: { action: string; feedback: string }) => void;
  done: boolean;
  timerCancel: (() => void) | null;
}

/** Stable error taxonomy for human-task failures. */
export class HumanTaskError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "HumanTaskError";
    this.code = code;
  }
}

/**
 * `ctx.humanTasks`: single active interaction, per-session gates, and mute state.
 *
 * The Client UI is a direct Remote consumer — it polls `poll()`, submits through
 * `submit()`, and reads/writes mute through `getMute()`/`setMute()`. The tools
 * call the host-side `showTask()`/`gate()`, which pause until the client submits
 * or the deadline expires.
 */
export class HumanTaskService extends TypertRemoteService {
  static inject = ["timer"];

  private denyAll = false;
  private readonly sessions = new Map<string, SessionRecord>();
  private active: Interaction | null = null;
  private locked = false;

  private muted = false;
  private mutedLoaded = false;
  private statePath = "";

  constructor(ctx: Context) {
    super(ctx, "humanTasks");
    this.statePath = this.resolveStatePath();
  }

  // ── Client-facing Remote surface ──────────────────────────────────────────

  /** Snapshot of the current interaction, or null when none is active. */
  @Remote("poll")
  poll(): InteractionSnapshot | null {
    if (this.active === null || this.active.done) return null;
    return this.snapshot(this.active);
  }

  /** Resolve (or extend) the active interaction from the browser. */
  @Remote("submit")
  submit(args: SubmitRequest): SubmitResult {
    const active = this.active;
    if (active === null || active.done || active.id !== args.id) {
      return { ok: false, error: "stale" };
    }
    const action = typeof args.action === "string" ? args.action : "";
    const feedback = typeof args.feedback === "string" ? args.feedback : "";
    if (action === "deny_all") this.denyAll = true;
    if (action === "extend" && active.kind === "task") {
      const extendMs = Math.max(1, numOr(args.minutes, 5)) * 60 * 1000;
      active.deadlineAt = active.deadlineAt + extendMs;
      if (active.timerCancel) {
        try {
          active.timerCancel();
        } catch {
          /* noop */
        }
      }
      const remainingMs = Math.max(0, active.deadlineAt - Date.now());
      active.timerCancel = (this.ctx as any).timeout(() => {
        this.complete(active, { action: "timeout", feedback: "" });
      }, remainingMs + 30 * 1000);
      return { ok: true, status: "in_progress", reason: "extended", deadlineAt: active.deadlineAt };
    }
    this.complete(active, { action, feedback });
    return { ok: true, status: "submitted" };
  }

  @Remote("getMute")
  async getMute(): Promise<MuteResult> {
    return { muted: await this.loadMuted() };
  }

  @Remote("setMute")
  async setMute(args: { muted: boolean }): Promise<MuteResult> {
    this.muted = typeof args?.muted === "boolean" ? args.muted : false;
    this.mutedLoaded = true;
    await this.persistMuted(this.muted);
    return { muted: this.muted };
  }

  // ── Tool-facing API ───────────────────────────────────────────────────────

  /**
   * Run the consent + AFK gate for a session, pausing on the client when a
   * dialog is required. Returns `ready` only once the user is available.
   */
  async gate(key: string, timeoutSeconds: number, forceAfk: boolean): Promise<GateResult> {
    if (this.denyAll) {
      return { status: "denied", reason: "deny_all", message: "User refused all future assistance", session: key, timestamp: nowIso() };
    }
    const rec = this.sessionFor(key);
    if (rec.consent === "denied") {
      return { status: "denied", reason: "session_declined", session: key, timestamp: nowIso() };
    }
    if (rec.consent !== "granted") {
      const consentRes = await this.show("consent", undefined, timeoutSeconds);
      const action = consentRes.action;
      if (action === "granted") {
        rec.consent = "granted";
        rec.consentTime = nowIso();
        rec.afkLastCheckMs = Date.now();
        rec.afkState = "present";
      } else {
        rec.consent = "denied";
        rec.consentTime = nowIso();
        if (action === "deny_all") this.denyAll = true;
        return { status: "denied", reason: this.consentReason(action), session: key, timestamp: nowIso() };
      }
    }
    if (forceAfk || this.afkDue(rec)) {
      const afkRes = await this.show("afk", undefined, timeoutSeconds);
      const action = afkRes.action;
      rec.afkLastCheckMs = Date.now();
      if (action === "present") {
        rec.afkState = "present";
      } else if (action === "deny_all") {
        this.denyAll = true;
        return { status: "denied", reason: "deny_all", session: key, timestamp: nowIso() };
      } else {
        rec.afkState = "afk";
        return { status: "afk", reason: this.afkReason(action), session: key, timestamp: nowIso() };
      }
    } else if (rec.afkState === "afk") {
      return { status: "afk", reason: "afk_state", session: key, timestamp: nowIso() };
    }
    return { status: "ready", source: "cache", session: key, timestamp: nowIso() } as GateResult;
  }

  /** Show the task dialog and wait for a terminal result. */
  async showTask(key: string, args: TaskFields, timeoutSeconds: number): Promise<TaskResult> {
    const res = await this.show(
      "task",
      {
        task_id: args.task_id,
        title: String(args.title || ""),
        instructions: normalizeInstructions(args.instructions),
        success_condition: typeof args.success_condition === "string" ? args.success_condition : "",
        feedback_request: typeof args.feedback_request === "string" ? args.feedback_request : "",
      },
      timeoutSeconds,
    );
    return this.buildTaskResult(args.task_id, res.action, res.feedback, key);
  }

  /** Serialize one task/tool call against the single active dialog. */
  async exclusive<T>(key: string, fn: () => Promise<T>): Promise<T | TaskResult> {
    if (this.locked || (this.active !== null && !this.active.done)) {
      return {
        task_id: null,
        session: key,
        timestamp: nowIso(),
        status: "error",
        user_feedback: "",
        reason: "busy",
        message: "Another human task dialog is already open",
      } as TaskResult;
    }
    this.locked = true;
    try {
      return await fn();
    } finally {
      this.locked = false;
    }
  }

  // ── Interaction plumbing ──────────────────────────────────────────────────

  private show(kind: InteractionKind, fields: TaskFields | undefined, timeoutSeconds: number): Promise<{ action: string; feedback: string }> {
    return new Promise((resolve) => {
      const safeSeconds = Math.max(0, timeoutSeconds);
      const interaction: Interaction = {
        id: newId(),
        kind,
        fields,
        deadlineAt: Date.now() + safeSeconds * 1000,
        timeoutSeconds: safeSeconds,
        resolve,
        done: false,
        timerCancel: null,
      };
      this.active = interaction;
      interaction.timerCancel = (this.ctx as any).timeout(() => {
        this.complete(interaction, { action: "timeout", feedback: "" });
      }, (safeSeconds + 15) * 1000);
    });
  }

  private complete(interaction: Interaction, payload: { action: string; feedback: string }): boolean {
    if (!interaction || interaction.done) return false;
    interaction.done = true;
    if (interaction.timerCancel) {
      try {
        interaction.timerCancel();
      } catch {
        /* noop */
      }
    }
    if (this.active === interaction) this.active = null;
    interaction.resolve(payload);
    return true;
  }

  private snapshot(interaction: Interaction): InteractionSnapshot {
    return {
      id: interaction.id,
      kind: interaction.kind,
      timeoutSeconds: interaction.timeoutSeconds,
      deadlineAt: interaction.deadlineAt,
      ...(interaction.fields !== undefined ? { fields: interaction.fields } : {}),
    };
  }

  private sessionFor(key: string): SessionRecord {
    let rec = this.sessions.get(key);
    if (rec === undefined) {
      rec = { consent: "", consentTime: "", afkLastCheckMs: null, afkState: "" };
      this.sessions.set(key, rec);
    }
    return rec;
  }

  private afkDue(rec: SessionRecord): boolean {
    if (rec.afkLastCheckMs == null) return true;
    return Date.now() - rec.afkLastCheckMs >= AFK_INTERVAL_MS;
  }

  private consentReason(action: string): string {
    if (action === "declined") return "declined";
    if (action === "deny_all") return "deny_all";
    if (action === "timeout") return "timeout";
    return "window_closed";
  }

  private afkReason(action: string): string {
    if (action === "timeout") return "timeout";
    return "window_closed";
  }

  private buildTaskResult(taskId: string, action: string, feedback: string, key: string): TaskResult {
    const base = { task_id: taskId, session: key, timestamp: nowIso() };
    const fb = typeof feedback === "string" ? feedback : "";
    switch (action) {
      case "success":
        return { ...base, status: "success", user_feedback: fb || "完成", reason: "success" };
      case "partial":
        return { ...base, status: "partial", user_feedback: fb || "部分完成", reason: "partial" };
      case "failed":
        return { ...base, status: "failed", user_feedback: fb || "失败", reason: "failed" };
      case "cancelled":
        return { ...base, status: "cancelled", user_feedback: fb, reason: "cancelled" };
      case "window_closed":
        return { ...base, status: "cancelled", user_feedback: fb, reason: "window_closed" };
      case "timeout":
        return { ...base, status: "timeout", user_feedback: fb, reason: "timeout" };
      case "deny_all":
        return { ...base, status: "denied", user_feedback: fb, reason: "deny_all" };
      default:
        return { ...base, status: "error", user_feedback: fb, reason: "unknown_action", message: "Unknown action: " + String(action) };
    }
  }

  // ── Mute persistence (workspace `.human-task-state.json`) ─────────────────

  private resolveStatePath(): string {
    const root = this.workspaceRoot();
    return root ? root + "/.human-task-state.json" : ".human-task-state.json";
  }

  private workspaceRoot(): string {
    try {
      const sessions = this.ctx.get("sessions");
      if (sessions && typeof (sessions as any).list === "function") {
        const list = (sessions as any).list();
        for (const item of list) {
          const cwd = item && item.header && item.header.cwd;
          if (typeof cwd === "string" && cwd.length > 0) return cwd.replace(/[\\/]+$/, "");
        }
      }
    } catch {
      /* noop */
    }
    try {
      const wr = this.ctx.get("workspaceRegistry");
      if (wr && typeof (wr as any).list === "function") {
        const list = (wr as any).list();
        for (const item of list) {
          const p = item && item.path;
          if (typeof p === "string" && p.length > 0) return p.replace(/[\\/]+$/, "");
        }
      }
    } catch {
      /* noop */
    }
    try {
      const sp = this.ctx.get("sandboxPolicy");
      if (sp && typeof (sp as any).workspaceRoot === "string" && (sp as any).workspaceRoot.length > 0) {
        return (sp as any).workspaceRoot.replace(/[\\/]+$/, "");
      }
    } catch {
      /* noop */
    }
    return "";
  }

  private async loadMuted(): Promise<boolean> {
    if (this.mutedLoaded) return this.muted;
    this.mutedLoaded = true;
    const fs = this.ctx.get("fs");
    if (fs === undefined) return this.muted;
    try {
      const target = await fs.resolve(this.statePath);
      const info = await fs.stat(target);
      if (info === undefined) return this.muted;
      const text = await fs.readText(target);
      const obj = JSON.parse(text);
      if (obj && typeof obj.muted === "boolean") this.muted = obj.muted;
    } catch {
      /* noop */
    }
    return this.muted;
  }

  private async persistMuted(value: boolean): Promise<void> {
    const fs = this.ctx.get("fs");
    if (fs === undefined) return;
    try {
      const target = await fs.resolve(this.statePath);
      await fs.writeText(target, JSON.stringify({ muted: value }));
    } catch {
      /* noop */
    }
  }
}

export default HumanTaskService;
