import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => readFile(path.join(root, file), "utf8");

test("theme bootstrap runs before the app and semantic tokens cover both themes", async () => {
  const [layout, css, theme] = await Promise.all([read("src/app/layout.tsx"), read("src/app/globals.css"), read("src/lib/theme.tsx")]);
  assert.match(layout, /themeBootstrap/);
  assert.match(layout, /<head>[\s\S]*dangerouslySetInnerHTML/);
  assert.doesNotMatch(layout, /<html[^>]+data-theme="dark"/);
  for (const token of ["--background", "--surface", "--surface-elevated", "--navy", "--gold", "--blue", "--focus-ring", "--quiz-option-bg", "--correct", "--wrong"]) assert.match(css, new RegExp(token));
  assert.match(theme, /prefers-color-scheme: dark/);
  assert.match(theme, /ThemePreference = Theme \| "system"/);
});

test("public routes use the shared shell and expose the required destinations", async () => {
  const [header, mobile, home, learn, library, research, leaderboard, privacy] = await Promise.all([
    read("src/components/shell/AppHeader.tsx"), read("src/components/shell/MobileBottomNavigation.tsx"), read("src/app/page.tsx"), read("src/app/learn/page.tsx"), read("src/app/library/page.tsx"), read("src/app/research/page.tsx"), read("src/app/leaderboard/page.tsx"), read("src/app/privacy/page.tsx"),
  ]);
  for (const label of ["Learn", "Library", "Live Quiz", "Research", "Leaderboard"]) assert.match(header, new RegExp(label));
  for (const label of ["Home", "Learn", "Quiz", "Library", "Account"]) assert.match(mobile, new RegExp(label));
  for (const route of [home, learn, library, research, leaderboard, privacy]) assert.match(route, /<AppShell/);
});

test("Graph links and UI-to-Engine secret naming follow the production contract", async () => {
  const [banner, research, env, proxy] = await Promise.all([read("src/components/shell/GraphPromoBanner.tsx"), read("src/app/research/page.tsx"), read(".env.example"), read("src/lib/server/engineProxy.ts")]);
  assert.match(banner, /target="_blank"/); assert.match(banner, /rel="noopener noreferrer"/);
  assert.match(research, /service === "apologia-graph-api"/);
  assert.match(env, /ENGINE_ADMIN_TOKEN=/); assert.doesNotMatch(env, /^ADMIN_TOKEN=/m);
  assert.match(proxy, /process\.env\.ENGINE_ADMIN_TOKEN/);
});

test("live registration remains compatible during the signed-token rollout", async () => {
  const [modal, hook, mobile] = await Promise.all([read("src/components/mobile/JoinGameModal.tsx"), read("src/hooks/useRoomRegistration.ts"), read("src/app/mobile/page.tsx")]);
  assert.match(modal, /data\.joinToken \?\? null/);
  assert.match(hook, /resumeLegacy/);
  assert.match(mobile, /\.\.\.\(joinToken \? \{ Authorization:/);
  assert.match(mobile, /if \(isUsingSSE && ENGINE_URL && userId\)/);
});
