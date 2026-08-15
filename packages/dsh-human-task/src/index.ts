/**
 * Service package entry. The Loader mounts a default-export `Service` subclass
 * as a provider, so the host composition row `@deepseek-ai/dsh-human-task`
 * publishes `ctx.humanTasks`.
 *
 * The Context augmentation below is what makes Typert DISCOVER this service:
 * the generator walks package public exports reachable from Cordis `Context`
 * augmentations, so without it no `@Remote` face is emitted for `humanTasks`.
 *
 * @module @deepseek-ai/dsh-human-task
 */
import type { HumanTaskService } from "./service.js";

declare module "@deepseek-ai/cordis" {
  interface Context {
    humanTasks: HumanTaskService;
  }
}

export { HumanTaskError, HumanTaskService } from "./service.js";
export { HumanTaskService as default } from "./service.js";
export type {
  GateResult,
  GateStatus,
  InteractionKind,
  InteractionSnapshot,
  MuteResult,
  SubmitRequest,
  SubmitResult,
  TaskFields,
  TaskResult,
  TaskResultStatus,
} from "./types.js";
