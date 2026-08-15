// DeepSeek Harness workspace build for the dsh-human-task plugin family.
//
// The Typert `/remote` generator hardcodes registration to packages under
// <root>/packages and resolves `@Remote` only when `@deepseek-ai/dsh-typert-protocol`
// is itself a workspace package. The three packages therefore MUST be built
// inside a DeepSeek Harness SOURCE checkout. This script:
//
//   1. copies the three packages into <harness>/packages/interaction/{human-task,
//      human-task-tools, human-task-client} (conventional dir names, `dsh-` dropped),
//   2. rewrites each package.json (workspace:^ deps, lib/types layout, exports/files)
//      and tsconfig.json (extends/outDir/references) to harness conventions,
//   3. adds a tsdown client config for the client package,
//   4. registers the packages in the harness host/client TS project graphs,
//   5. runs `pnpm install`, `pnpm run build:lib:host`, `pnpm run build:lib:client`,
//   6. packs the three .tgz into <repo>/build.
//
// usage: node scripts/harness-build.mjs <harness-source-dir> [--skip-install] [--skip-build] [--skip-pack]
import { cpSync, rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const harnessArg = process.argv[2];
if (!harnessArg || harnessArg.startsWith("--")) {
  console.error("usage: node scripts/harness-build.mjs <harness-source-dir> [--skip-install] [--skip-build] [--skip-pack]");
  process.exit(1);
}
const harness = resolve(harnessArg);
if (!existsSync(join(harness, "pnpm-workspace.yaml")) || !existsSync(join(harness, "tsconfig.host.json"))) {
  console.error(`[harness-build] ${harness} does not look like a DeepSeek Harness source checkout`);
  process.exit(1);
}
const flags = new Set(process.argv.slice(3));

function run(cmd, args, cwd = harness, extraEnv = {}) {
  console.log(">", cmd, args.join(" "));
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...extraEnv },
  });
  if (r.status !== 0) {
    console.error(`[harness-build] command failed (${r.status}): ${cmd} ${args.join(" ")}`);
    process.exit(r.status ?? 1);
  }
}

const GROUP = "interaction";

/** source package dir -> { dir: harness dir name under packages/<group>, face } */
const PACKAGES = {
  "dsh-human-task": { dir: "human-task", face: "host" },
  "dsh-human-task-tools": { dir: "human-task-tools", face: "host" },
  "dsh-human-task-client": { dir: "human-task-client", face: "client" },
};

// ── 1. copy + clean stale build output ──────────────────────────────────────
// Remove any compiled artifacts that leaked into src/ (keep only .ts/.tsx).
function cleanSrc(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) cleanSrc(p);
    else if (!/\.(ts|tsx)$/.test(entry.name)) rmSync(p, { force: true });
  }
}

for (const [src, meta] of Object.entries(PACKAGES)) {
  const dest = join(harness, "packages", GROUP, meta.dir);
  rmSync(dest, { recursive: true, force: true });
  cpSync(join(repoRoot, "packages", src), dest, { recursive: true });
  cleanSrc(join(dest, "src"));
  rmSync(join(dest, "lib"), { recursive: true, force: true });
  rmSync(join(dest, "node_modules"), { recursive: true, force: true });
  console.log(`[harness-build] copied packages/${src} -> packages/${GROUP}/${meta.dir}`);
}

// ── 2. package.json rewrites (workspace:^, lib/types layout) ────────────────
function writeJson(p, obj) {
  writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
}

writeJson(join(harness, "packages", GROUP, "human-task", "package.json"), {
  name: "@deepseek-ai/dsh-human-task",
  description: "Human-in-the-loop capability seam (ctx.humanTasks): pause an agent tool until the human performs a real-world task or returns an observation",
  version: "0.1.0",
  publishConfig: { access: "public" },
  type: "module",
  main: "lib/index.js",
  types: "lib/types/index.d.ts",
  exports: {
    ".": { types: "./lib/types/index.d.ts", default: "./lib/index.js" },
    "./types": { types: "./lib/types/types.d.ts", default: "./lib/types/types.js" },
    "./typert": { types: "./lib/typert.host.d.ts", default: "./lib/typert.host.js" },
    "./remote": { types: "./lib/typert.remote-client.d.ts", default: "./lib/typert.remote-client.js" },
    "./src/*": "./src/*",
    "./package.json": "./package.json",
  },
  files: [
    "lib/index.js",
    "lib/types/**/*.js",
    "lib/types/**/*.d.ts",
    "lib/typert.host.js",
    "lib/typert.host.d.ts",
    "lib/typert.remote-client.js",
    "lib/typert.remote-client.d.ts",
  ],
  license: "MIT",
  dependencies: {
    // The generated `./typert` and `./remote` faces encode codecs with zod
    // (`import { z } from 'zod'`). Declared here so the emitted face resolves
    // zod when another package inlines it (the client bundle) and at host
    // runtime (typert loader reflection) — mirroring `dsh-goal`.
    zod: "^4.4.3",
  },
  peerDependencies: {
    "@deepseek-ai/cordis": "workspace:^",
    "@deepseek-ai/dsh-typert-protocol": "workspace:^",
  },
  devDependencies: {
    "@deepseek-ai/cordis": "workspace:^",
    "@deepseek-ai/dsh-typert-protocol": "workspace:^",
  },
});

writeJson(join(harness, "packages", GROUP, "human-task-tools", "package.json"), {
  name: "@deepseek-ai/dsh-human-task-tools",
  description: "Model-facing human_task / human_task_ready_check tools and the human-task skill over the ctx.humanTasks seam",
  version: "0.1.0",
  publishConfig: { access: "public" },
  type: "module",
  main: "lib/index.js",
  types: "lib/types/index.d.ts",
  exports: {
    ".": { types: "./lib/types/index.d.ts", default: "./lib/index.js" },
    "./src/*": "./src/*",
    "./package.json": "./package.json",
  },
  files: [
    "lib/index.js",
    "lib/types/**/*.js",
    "lib/types/**/*.d.ts",
  ],
  license: "MIT",
  peerDependencies: {
    "@deepseek-ai/cordis": "workspace:^",
    "@deepseek-ai/dsh-human-task": "workspace:^",
    "@deepseek-ai/dsh-skill": "workspace:^",
    "@deepseek-ai/dsh-tools": "workspace:^",
  },
  devDependencies: {
    "@deepseek-ai/cordis": "workspace:^",
    "@deepseek-ai/dsh-human-task": "workspace:^",
    "@deepseek-ai/dsh-skill": "workspace:^",
    "@deepseek-ai/dsh-tools": "workspace:^",
  },
});

writeJson(join(harness, "packages", GROUP, "human-task-client", "package.json"), {
  name: "@deepseek-ai/dsh-human-task-client",
  description: "Web human-task feature: consent / AFK / task dialogs in shell.overlay over the ctx.humanTasks Remote face",
  version: "0.1.0",
  publishConfig: { access: "public" },
  type: "module",
  main: "lib/index.js",
  types: "lib/types/index.d.ts",
  exports: {
    ".": { types: "./lib/types/index.d.ts", default: "./lib/index.js" },
    "./client": { types: "./lib/types/client/index.d.ts", default: "./lib/client.js" },
    "./src/*": "./src/*",
    "./package.json": "./package.json",
  },
  dsh: {
    client: {
      inject: [
        "@deepseek-ai/dsh-client-runtime",
        "@deepseek-ai/dsh-api-remotes",
        "@deepseek-ai/dsh-client-locale",
        "@deepseek-ai/dsh-client-ui-slots",
        "@deepseek-ai/dsh-client-ui-theme",
      ],
      platform: "web",
    },
  },
  scripts: {
    bundle: "tsdown",
    watch: "tsdown --watch",
  },
  license: "MIT",
  peerDependencies: {
    "@deepseek-ai/cordis": "workspace:^",
    "@deepseek-ai/dsh-api-remotes": "workspace:^",
    "@deepseek-ai/dsh-client-locale": "workspace:^",
    "@deepseek-ai/dsh-client-runtime": "workspace:^",
    "@deepseek-ai/dsh-client-ui-slots": "workspace:^",
    "@deepseek-ai/dsh-client-ui-theme": "workspace:^",
    react: "^18.2.0",
  },
  devDependencies: {
    "@deepseek-ai/cordis": "workspace:^",
    "@deepseek-ai/dsh-api-remotes": "workspace:^",
    "@deepseek-ai/dsh-client-locale": "workspace:^",
    "@deepseek-ai/dsh-client-runtime": "workspace:^",
    "@deepseek-ai/dsh-client-ui-slots": "workspace:^",
    "@deepseek-ai/dsh-client-ui-theme": "workspace:^",
    "@deepseek-ai/dsh-human-task": "workspace:^",
    "@types/react": "~18.3.1",
    react: "^18.2.0",
    "react-dom": "^18.2.0",
  },
  files: [
    "lib/index.js",
    "lib/client.js",
    "lib/types/**/*.js",
    "lib/types/**/*.d.ts",
  ],
});

// ── 3. tsconfig rewrites ────────────────────────────────────────────────────
writeJson(join(harness, "packages", GROUP, "human-task", "tsconfig.json"), {
  extends: "../../../tsconfig.base.json",
  compilerOptions: { rootDir: "src", outDir: "lib/types" },
  include: ["src"],
  references: [
    { path: "../../../vendor/cordis" },
    { path: "../../typert/protocol" },
  ],
});

writeJson(join(harness, "packages", GROUP, "human-task-tools", "tsconfig.json"), {
  extends: "../../../tsconfig.base.json",
  compilerOptions: { rootDir: "src", outDir: "lib/types" },
  include: ["src"],
  references: [
    { path: "../../../vendor/cordis" },
    { path: "../../core/tools" },
    { path: "../../skill/skill" },
    { path: "../../interaction/human-task" },
  ],
});

writeJson(join(harness, "packages", GROUP, "human-task-client", "tsconfig.json"), {
  extends: "../../../tsconfig.base.client.json",
  compilerOptions: { rootDir: "src", outDir: "lib/types" },
  include: ["src"],
  references: [
    { path: "../../../vendor/cordis" },
    { path: "../../api/remotes/tsconfig.client.json" },
    { path: "../../client/runtime" },
    { path: "../../client/locale" },
    { path: "../../client/ui-slots" },
    { path: "../../client/ui-theme" },
    { path: "../../interaction/human-task" },
  ],
});

// ── 4. client tsdown config ─────────────────────────────────────────────────
writeFileSync(
  join(harness, "packages", GROUP, "human-task-client", "tsdown.config.ts"),
  "import { clientBundle } from '../../client/tsdown.client.ts'\n\n"
  + "export default clientBundle('@deepseek-ai/dsh-human-task-client', ['lib/types/index.js'])\n",
);

// ── 5. register in the aggregate TS project graphs ──────────────────────────
// Harness tsconfig files are JSONC (comments + trailing commas); strip them.
function stripJsonc(text) {
  let out = "";
  let i = 0;
  let inString = false;
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (inString) {
      out += c;
      if (c === "\\") { out += next ?? ""; i += 2; continue; }
      if (c === '"') inString = false;
      i += 1;
      continue;
    }
    if (c === '"') { inString = true; out += c; i += 1; continue; }
    if (c === "/" && next === "/") { while (i < text.length && text[i] !== "\n") i += 1; continue; }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    out += c;
    i += 1;
  }
  return out.replace(/,\s*([}\]])/g, "$1");
}

function registerReference(aggregatePath, refPath) {
  const cfg = JSON.parse(stripJsonc(readFileSync(join(harness, aggregatePath), "utf8")));
  const refs = (cfg.references ??= []);
  if (!refs.some((r) => r.path === refPath)) refs.push({ path: refPath });
  writeFileSync(join(harness, aggregatePath), JSON.stringify(cfg, null, 2) + "\n");
}

registerReference("tsconfig.host.json", "./packages/interaction/human-task");
registerReference("tsconfig.host.json", "./packages/interaction/human-task-tools");
registerReference("tsconfig.client.json", "./packages/interaction/human-task-client");
console.log("[harness-build] registered tsconfig references");

// ── 6. install ──────────────────────────────────────────────────────────────
if (!flags.has("--skip-install")) {
  // The three packages are copied in AFTER the harness lockfile was written, so
  // the lockfile is necessarily out of date. CI sets `frozen-lockfile` by
  // default (pnpm reads CI=true); disable it explicitly so pnpm records the new
  // workspace members instead of failing.
  run("pnpm", ["install", "--no-frozen-lockfile"], harness);
}

// ── 7. build host + client ──────────────────────────────────────────────────
if (!flags.has("--skip-build")) {
  run("pnpm", ["run", "build:lib:host"], harness);
  run("pnpm", ["run", "build:lib:client"], harness);
}

// ── 8. pack ─────────────────────────────────────────────────────────────────
if (!flags.has("--skip-pack")) {
  const buildDir = join(repoRoot, "build");
  mkdirSync(buildDir, { recursive: true });
  // Clean only stale tarballs; keep README.md / .gitkeep (the directory is
  // part of the repo, not a pure build artifact).
  for (const f of readdirSync(buildDir)) {
    if (f.endsWith(".tgz")) rmSync(join(buildDir, f), { force: true });
  }
  run(
    "pnpm",
    [
      "-r",
      "--filter", "@deepseek-ai/dsh-human-task",
      "--filter", "@deepseek-ai/dsh-human-task-tools",
      "--filter", "@deepseek-ai/dsh-human-task-client",
      "pack",
      "--pack-destination", buildDir,
    ],
    harness,
  );
  console.log("[harness-build] packed ->", buildDir);
}

console.log("[harness-build] done");
