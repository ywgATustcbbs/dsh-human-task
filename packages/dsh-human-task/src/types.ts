/**
 * Wire-safe types for the human-task capability seam (`ctx.humanTasks`).
 *
 * These shapes cross the Client<->Host boundary (Remote face), so they are
 * plain JSON: no Cordis objects, Services, or Contexts. Keep them dependency-free
 * so the browser type chain can consume them without loading the host Context
 * augmentation.
 *
 * @module @deepseek-ai/dsh-human-task/types
 */

/** Which dialog the current interaction renders. */
export type InteractionKind = "consent" | "afk" | "task"

/** Fields a task interaction carries (verbatim, never re-parsed). */
export interface TaskFields {
  task_id: string
  title: string
  instructions: string[]
  success_condition: string
  feedback_request: string
}

/**
 * The client-visible snapshot of the single active interaction.
 *
 * Only leaf JSON values; `resolve`/`timerCancel` stay host-private on the live
 * record and are never serialized into this shape.
 */
export interface InteractionSnapshot {
  id: string
  kind: InteractionKind
  timeoutSeconds: number
  deadlineAt: number
  fields?: TaskFields
}

/** Client -> Host submission for the active interaction. */
export interface SubmitRequest {
  id: string
  action: string
  feedback?: string
  /** Extension minutes, only meaningful for `action: "extend"` on a task. */
  minutes?: number
}

/** Host -> Client acknowledgement of a submission. */
export interface SubmitResult {
  ok: boolean
  status?: string
  reason?: string
  deadlineAt?: number
  error?: string
}

/** Mute preference read/written through the Remote face. */
export interface MuteResult {
  muted: boolean
}

/** Terminal statuses a completed human task can resolve to. */
export type TaskResultStatus =
  | "success"
  | "partial"
  | "failed"
  | "cancelled"
  | "timeout"
  | "error"
  | "denied"

/** Gate (consent + AFK) statuses, distinct from the task statuses above. */
export type GateStatus = "ready" | "granted" | "present" | "afk" | "denied"

/** Result the tool body returns for a completed task interaction. */
export interface TaskResult {
  task_id: string | null
  session: string
  timestamp: string
  status: TaskResultStatus
  user_feedback: string
  reason: string
  message?: string
}

/** Result the tool body returns for a gate-only check. */
export interface GateResult {
  status: GateStatus
  reason?: string
  message?: string
  session: string
  timestamp: string
  source?: string
}
