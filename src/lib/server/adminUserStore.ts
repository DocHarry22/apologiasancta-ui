import { randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { isRole, type Role } from "@/lib/auth/roles";

export type AdminUserStatus = "active" | "inactive";

export interface AdminUser {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: Role;
  status: AdminUserStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
}

type MysqlPool = {
  execute: (sql: string, values?: unknown[]) => Promise<[unknown[], unknown]>;
};

let poolPromise: Promise<MysqlPool> | null = null;
let initialized = false;
const memoryUsers = new Map<string, AdminUser>();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hasMysqlConfig(): boolean {
  return Boolean(
    process.env.DATABASE_URL ||
    (process.env.MYSQL_HOST && process.env.MYSQL_DATABASE && process.env.MYSQL_USER && process.env.MYSQL_PASSWORD)
  );
}

function allowMemoryStore(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ADMIN_AUTH_MEMORY_STORE === "true";
}

function getSeedRole(): Role {
  return isRole(process.env.ADMIN_ROLE) ? process.env.ADMIN_ROLE : "super_admin";
}

function getSeedDisplayName(email: string): string {
  return process.env.ADMIN_DISPLAY_NAME?.trim() || email.split("@")[0] || "Admin";
}

function getMemorySeedId(email: string): string {
  return `seed-admin-${Buffer.from(email).toString("base64url")}`;
}

async function getMysqlPool(): Promise<MysqlPool> {
  if (poolPromise) return poolPromise;

  poolPromise = (async () => {
    const importer = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<{
      createPool: (config: string | Record<string, unknown>) => MysqlPool;
    }>;
    const mysql = await importer("mysql2/promise");

    if (process.env.DATABASE_URL) {
      return mysql.createPool(process.env.DATABASE_URL);
    }

    return mysql.createPool({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT || 3306),
      database: process.env.MYSQL_DATABASE,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      waitForConnections: true,
      connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 5),
    });
  })();

  return poolPromise;
}

async function ensureSchema(): Promise<void> {
  const pool = await getMysqlPool();
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id VARCHAR(64) PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(255) NOT NULL,
      role VARCHAR(32) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      last_login_at DATETIME NULL,
      INDEX idx_admin_users_email (email),
      INDEX idx_admin_users_status (status)
    )
  `);
}

function rowToUser(row: Record<string, unknown>): AdminUser {
  const role = typeof row.role === "string" && isRole(row.role) ? row.role : "viewer";
  const status = row.status === "inactive" ? "inactive" : "active";
  return {
    id: String(row.id),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    displayName: String(row.display_name),
    role,
    status,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : null,
  };
}

async function findDbUserByEmail(email: string): Promise<AdminUser | null> {
  const pool = await getMysqlPool();
  const [rows] = await pool.execute("SELECT * FROM admin_users WHERE email = ? LIMIT 1", [normalizeEmail(email)]);
  const first = (rows as Record<string, unknown>[])[0];
  return first ? rowToUser(first) : null;
}

async function findDbUserById(id: string): Promise<AdminUser | null> {
  const pool = await getMysqlPool();
  const [rows] = await pool.execute("SELECT * FROM admin_users WHERE id = ? LIMIT 1", [id]);
  const first = (rows as Record<string, unknown>[])[0];
  return first ? rowToUser(first) : null;
}

async function upsertSeedAdmin(): Promise<void> {
  const email = normalizeEmail(process.env.ADMIN_EMAIL || "");
  const password = process.env.ADMIN_PASSWORD || "";
  if (!email || !password) return;

  const role = getSeedRole();
  const displayName = getSeedDisplayName(email);
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  if (!hasMysqlConfig()) {
    if (!allowMemoryStore()) return;
    const existing = memoryUsers.get(email);
    if (existing) {
      memoryUsers.set(email, {
        ...existing,
        displayName,
        role,
        status: "active",
        passwordHash: process.env.ADMIN_BOOTSTRAP_OVERWRITE_PASSWORD === "true" ? await hashPassword(password) : existing.passwordHash,
        updatedAt: now,
      });
      return;
    }
    memoryUsers.set(email, {
      id: getMemorySeedId(email),
      email,
      passwordHash: await hashPassword(password),
      displayName,
      role,
      status: "active",
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    });
    return;
  }

  await ensureSchema();
  const existing = await findDbUserByEmail(email);
  const pool = await getMysqlPool();

  if (existing) {
    const passwordSql = process.env.ADMIN_BOOTSTRAP_OVERWRITE_PASSWORD === "true" ? ", password_hash = ?" : "";
    const values: unknown[] = process.env.ADMIN_BOOTSTRAP_OVERWRITE_PASSWORD === "true"
      ? [displayName, role, "active", await hashPassword(password), email]
      : [displayName, role, "active", email];
    await pool.execute(
      `UPDATE admin_users SET display_name = ?, role = ?, status = ?, updated_at = CURRENT_TIMESTAMP${passwordSql} WHERE email = ?`,
      values
    );
    return;
  }

  await pool.execute(
    `INSERT INTO admin_users (id, email, password_hash, display_name, role, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [randomUUID(), email, await hashPassword(password), displayName, role]
  );
}

export async function ensureAdminUserStore(): Promise<void> {
  if (initialized) return;

  if (!hasMysqlConfig() && !allowMemoryStore()) {
    throw new Error("Admin user database is not configured. Set DATABASE_URL or MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER, and MYSQL_PASSWORD.");
  }

  if (hasMysqlConfig()) {
    await ensureSchema();
  }
  await upsertSeedAdmin();
  initialized = true;
}

export async function getAdminUserById(id: string): Promise<AdminUser | null> {
  await ensureAdminUserStore();
  if (!hasMysqlConfig()) {
    return Array.from(memoryUsers.values()).find((user) => user.id === id) ?? null;
  }
  return findDbUserById(id);
}

export async function authenticateAdminUser(email: string, password: string): Promise<AdminUser | null> {
  await ensureAdminUserStore();
  const normalizedEmail = normalizeEmail(email);
  const user = hasMysqlConfig()
    ? await findDbUserByEmail(normalizedEmail)
    : memoryUsers.get(normalizedEmail) ?? null;

  if (!user || user.status !== "active") return null;
  if (!(await verifyPassword(password, user.passwordHash))) return null;

  await markAdminUserLogin(user.id);
  return { ...user, lastLoginAt: new Date().toISOString() };
}

export async function markAdminUserLogin(id: string): Promise<void> {
  if (!hasMysqlConfig()) {
    for (const [email, user] of memoryUsers) {
      if (user.id === id) {
        memoryUsers.set(email, { ...user, lastLoginAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        return;
      }
    }
    return;
  }

  const pool = await getMysqlPool();
  await pool.execute("UPDATE admin_users SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
}

export function resetAdminUserStoreForTests(): void {
  initialized = false;
  memoryUsers.clear();
  poolPromise = null;
}
