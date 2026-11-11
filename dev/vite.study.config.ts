// Dev server for the P1 motion study: the site's own config, with the
// git-ignored QA output and agent worktrees kept out of the file watcher so a
// build elsewhere in the checkout does not reload the study mid-recording.
// Usage: npx vite --config dev/vite.study.config.ts --host 127.0.0.1 --port <free port>
import { defineConfig, mergeConfig, type UserConfig } from "vite";
import base from "../vite.config";

export default defineConfig((env) =>
  mergeConfig((base as (e: typeof env) => UserConfig)(env), {
    root: process.cwd(),
    server: { watch: { ignored: ["**/.claude/**", "**/.qa/**", "**/dist/**", "**/.superpowers/**"] } },
  }),
);
