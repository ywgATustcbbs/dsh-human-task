/**
 * Web human-task plugin, node half.
 *
 * Deliberately empty: the model-facing tools belong to the agent preset
 * (`dsh-human-task-tools`), never to this host-UI package. The
 * browser half lives in `src/client/index.tsx` and is bundled by Client tsdown;
 * this file only exists so the package is a valid host plugin row.
 *
 * @module dsh-human-task-client
 */

/** Host plugin body — no host-side effect. */
export function apply(): void {}
