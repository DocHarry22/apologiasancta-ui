import test from "node:test";
import assert from "node:assert/strict";
import {
  checkLoginRateLimit,
  checkSignupRateLimit,
  clearLoginRateLimit,
  clearSignupRateLimit,
  getClientIp,
} from "../src/lib/auth/rateLimit.ts";
import {
  createSessionCookie,
  hasSessionSecret,
  hasStrongSessionSecret,
  hasValidSessionClaims,
  readSessionCookie,
  SESSION_MAX_AGE_SECONDS,
} from "../src/lib/auth/session.ts";
import {
  convertToPostgresPlaceholders,
  getAdminDatabaseDialect,
} from "../src/lib/auth/databaseConfig.ts";

test("admin database configuration selects PostgreSQL and MySQL explicitly", () => {
  assert.equal(getAdminDatabaseDialect({ DATABASE_URL: "postgres://user:secret@db.example/app" }), "postgres");
  assert.equal(getAdminDatabaseDialect({ DATABASE_URL: "postgresql://user:secret@db.example/app" }), "postgres");
  assert.equal(getAdminDatabaseDialect({ DATABASE_URL: "mysql://user:secret@db.example/app" }), "mysql");
  assert.equal(getAdminDatabaseDialect({ DATABASE_URL: "https://db.example/app" }), null);
  assert.equal(getAdminDatabaseDialect({
    MYSQL_HOST: "db.example",
    MYSQL_DATABASE: "app",
    MYSQL_USER: "user",
    MYSQL_PASSWORD: "secret",
  }), "mysql");
  assert.equal(getAdminDatabaseDialect({ MYSQL_HOST: "db.example" }), null);
});

test("PostgreSQL query placeholders are numbered in parameter order", () => {
  assert.equal(
    convertToPostgresPlaceholders("UPDATE admin_users SET role = ?, status = ? WHERE id = ?"),
    "UPDATE admin_users SET role = $1, status = $2 WHERE id = $3"
  );
});

test("session secrets and signed claims are bounded", async () => {
  const previousSecret = process.env.AUTHOR_SESSION_SECRET;
  process.env.AUTHOR_SESSION_SECRET = "a-secure-test-secret-with-at-least-32-characters";
  try {
    assert.equal(hasStrongSessionSecret("short"), false);
    assert.equal(hasSessionSecret("short"), true);
    assert.equal(hasStrongSessionSecret(), true);
    const cookie = await createSessionCookie("admin-user");
    assert.equal((await readSessionCookie(cookie))?.userId, "admin-user");
    assert.equal(await readSessionCookie("x".repeat(4097)), null);

    const now = Date.now();
    assert.equal(hasValidSessionClaims({ v: 2, uid: "admin", iat: now, exp: now + 1000 }, now), true);
    assert.equal(hasValidSessionClaims({ v: 2, uid: "", iat: now, exp: now + 1000 }, now), false);
    assert.equal(hasValidSessionClaims({ v: 2, uid: "admin", iat: now + 120_000, exp: now + 121_000 }, now), false);
    assert.equal(hasValidSessionClaims({ v: 2, uid: "admin", iat: now, exp: now + (SESSION_MAX_AGE_SECONDS + 120) * 1000 }, now), false);
    assert.equal(hasValidSessionClaims({ v: 2, uid: "admin", iat: now, exp: now - 1 }, now), false);
  } finally {
    if (previousSecret === undefined) delete process.env.AUTHOR_SESSION_SECRET;
    else process.env.AUTHOR_SESSION_SECRET = previousSecret;
  }
});

test("login and signup limits are independent and signup success cannot clear login attempts", () => {
  const key = `auth-test-${Date.now()}`;
  clearLoginRateLimit(key);
  clearSignupRateLimit(key);
  for (let attempt = 0; attempt < 10; attempt += 1) assert.equal(checkLoginRateLimit(key).allowed, true);
  assert.equal(checkLoginRateLimit(key).allowed, false);
  for (let attempt = 0; attempt < 5; attempt += 1) assert.equal(checkSignupRateLimit(key).allowed, true);
  assert.equal(checkSignupRateLimit(key).allowed, false);
  assert.equal(checkLoginRateLimit(key).allowed, false);
  clearLoginRateLimit(key);
  clearSignupRateLimit(key);
});

test("proxy-aware client IP selection prefers the trusted real-IP header", () => {
  const request = {
    headers: new Headers({
      "x-real-ip": "203.0.113.8",
      "x-forwarded-for": "spoofed, 198.51.100.20",
    }),
  };
  assert.equal(getClientIp(request as never), "203.0.113.8");

  const forwardedOnly = { headers: new Headers({ "x-forwarded-for": "spoofed, 198.51.100.21" }) };
  assert.equal(getClientIp(forwardedOnly as never), "198.51.100.21");
});
