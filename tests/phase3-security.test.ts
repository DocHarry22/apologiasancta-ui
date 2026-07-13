import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("browser admin clients do not send x-admin-token", () => {
  const adminProxyClient = readFileSync("src/lib/adminProxyClient.ts", "utf8");
  const mobileAdminDrawer = readFileSync("src/components/mobile/AdminDrawer.tsx", "utf8");

  assert.equal(adminProxyClient.includes("x-admin-token"), false);
  assert.equal(mobileAdminDrawer.includes("x-admin-token"), false);
});

test("staff invite codes use constant-time digest comparison", () => {
  const invite = readFileSync("src/lib/auth/invite.ts", "utf8");
  assert.ok(invite.includes("timingSafeEqual"));
  assert.ok(invite.includes('createHash("sha256")'));
  assert.equal(invite.includes("expectedCode !== providedCode"), false);
});
