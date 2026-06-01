import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  process.env.ADMIN_EMAIL = "admin@example.test";
  process.env.ADMIN_PASSWORD = "test-author-password";
  process.env.ADMIN_AUTH_MEMORY_STORE = "true";
  process.env.AUTHOR_SESSION_SECRET = "test-session-secret-that-is-long-enough";
  process.env.ENGINE_INTERNAL_URL = "https://engine.test";
  process.env.ENGINE_ADMIN_TOKEN = "server-only-admin-token";
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
