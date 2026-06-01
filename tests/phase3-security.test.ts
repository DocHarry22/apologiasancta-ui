import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("browser admin clients do not send x-admin-token", () => {
  const adminProxyClient = readFileSync("src/lib/adminProxyClient.ts", "utf8");
  const mobileAdminDrawer = readFileSync("src/components/mobile/AdminDrawer.tsx", "utf8");

  assert.equal(adminProxyClient.includes("x-admin-token"), false);
  assert.equal(mobileAdminDrawer.includes("x-admin-token"), false);
});
