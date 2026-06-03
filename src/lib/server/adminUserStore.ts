import { randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { isRole, type Role } from "@/lib/auth/roles";

export type AdminUserStatus = "active" | "inactive";
export type AdminUserAccountType = "staff" | "public";

export interface AdminUser {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: Role;
  accountType: AdminUserAccountType;
  phone?: string | null;
  passwordChangedAt?: string | null;
  status: AdminUserStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
}

export interface CreateAdminUserInput {
  email: string;
  password: string;
  displayName: string;
  role: Role;
  accountType: AdminUserAccountType;
  phone?: string | null;
}

export interface AdminUserProfile {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  accountType: AdminUserAccountType;
  phone?: string | null;
  passwordChangedAt?: string | null;
  status: AdminUserStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
}

export interface UpdateAdminUserInput {
  id: string;
  displayName?: string;
  role?: Role;
  status?: AdminUserStatus;
  phone?: string | null;
}

export type ChangeAdminUserPasswordResult = "ok" | "not_found" | "invalid_current";
export type RevokeAdminUserSessionsResult = "ok" | "not_found";

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
      account_type VARCHAR(32) NOT NULL DEFAULT 'staff',
      phone VARCHAR(64) NULL,
      password_changed_at DATETIME NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      last_login_at DATETIME NULL,
      INDEX idx_admin_users_email (email),
      INDEX idx_admin_users_status (status)
    )
  `);

  // Best-effort migration for existing deployments.
  await pool.execute("ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS account_type VARCHAR(32) NOT NULL DEFAULT 'staff'");
  await pool.execute("ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS phone VARCHAR(64) NULL");
  await pool.execute("ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS password_changed_at DATETIME NULL");
}

function rowToUser(row: Record<string, unknown>): AdminUser {
  const role = typeof row.role === "string" && isRole(row.role) ? row.role : "viewer";
  const status = row.status === "inactive" ? "inactive" : "active";
  const accountType = row.account_type === "public" ? "public" : "staff";
  const phone = typeof row.phone === "string" && row.phone.trim() ? row.phone : null;
  const passwordChangedAt = row.password_changed_at ? String(row.password_changed_at) : null;
  return {
    id: String(row.id),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    displayName: String(row.display_name),
    role,
    accountType,
    phone,
    passwordChangedAt,
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

function toAdminUserProfile(user: AdminUser): AdminUserProfile {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    accountType: user.accountType,
    phone: user.phone ?? null,
    passwordChangedAt: user.passwordChangedAt ?? null,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt ?? null,
  };
}

async function listDbUsers(): Promise<AdminUser[]> {
  const pool = await getMysqlPool();
  const [rows] = await pool.execute("SELECT * FROM admin_users ORDER BY created_at DESC");
  return (rows as Record<string, unknown>[]).map(rowToUser);
}

async function countActiveSuperAdmins(): Promise<number> {
  if (!hasMysqlConfig()) {
    let count = 0;
    for (const user of memoryUsers.values()) {
      if (user.status === "active" && user.role === "super_admin") count += 1;
    }
    return count;
  }

  const pool = await getMysqlPool();
  const [rows] = await pool.execute(
    "SELECT COUNT(*) AS count FROM admin_users WHERE role = 'super_admin' AND status = 'active'"
  );
  const first = (rows as Array<{ count?: number | string }>)[0];
  return Number(first?.count ?? 0);
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
        accountType: "staff",
        phone: existing.phone ?? null,
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
      accountType: "staff",
      phone: null,
      passwordChangedAt: null,
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
    `INSERT INTO admin_users (id, email, password_hash, display_name, role, account_type, phone, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'staff', NULL, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
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

export async function createAdminUser(input: CreateAdminUserInput): Promise<AdminUser | null> {
  await ensureAdminUserStore();

  const email = normalizeEmail(input.email);
  const displayName = input.displayName.trim();
  const password = input.password;
  const role = input.role;
  const accountType = input.accountType;
  const phone = input.phone?.trim() || null;

  if (!email || !password || !displayName) {
    return null;
  }

  const existing = hasMysqlConfig()
    ? await findDbUserByEmail(email)
    : memoryUsers.get(email) ?? null;

  if (existing) {
    return null;
  }

  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);
  const created: AdminUser = {
    id: randomUUID(),
    email,
    passwordHash,
    displayName,
    role,
    accountType,
    phone,
    passwordChangedAt: null,
    status: "active",
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  };

  if (!hasMysqlConfig()) {
    memoryUsers.set(email, created);
    return created;
  }

  const pool = await getMysqlPool();
  await pool.execute(
    `INSERT INTO admin_users (id, email, password_hash, display_name, role, account_type, phone, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [created.id, created.email, created.passwordHash, created.displayName, created.role, created.accountType, created.phone]
  );

  return created;
}

export async function listAdminUsers(): Promise<AdminUserProfile[]> {
  await ensureAdminUserStore();
  const users = hasMysqlConfig() ? await listDbUsers() : Array.from(memoryUsers.values());
  return users.map(toAdminUserProfile);
}

export async function updateAdminUser(input: UpdateAdminUserInput): Promise<AdminUserProfile | null> {
  await ensureAdminUserStore();
  const existing = await getAdminUserById(input.id);
  if (!existing) return null;

  const nextRole = input.role ?? existing.role;
  const nextStatus = input.status ?? existing.status;
  const nextDisplayName = input.displayName?.trim() || existing.displayName;
  const nextPhone = input.phone === undefined ? existing.phone ?? null : (input.phone?.trim() || null);

  if (!nextDisplayName) {
    return null;
  }

  // Ensure there is always at least one active super admin account.
  const removesSuperAdmin = existing.role === "super_admin" && (nextRole !== "super_admin" || nextStatus !== "active");
  if (removesSuperAdmin) {
    const activeSuperAdmins = await countActiveSuperAdmins();
    if (activeSuperAdmins <= 1) {
      return null;
    }
  }

  if (!hasMysqlConfig()) {
    const updatedAt = new Date().toISOString();
    for (const [email, user] of memoryUsers) {
      if (user.id !== input.id) continue;
      const updated: AdminUser = {
        ...user,
        role: nextRole,
        status: nextStatus,
        displayName: nextDisplayName,
        phone: nextPhone,
        updatedAt,
      };
      memoryUsers.set(email, updated);
      return toAdminUserProfile(updated);
    }
    return null;
  }

  const pool = await getMysqlPool();
  await pool.execute(
    `UPDATE admin_users
     SET display_name = ?, role = ?, status = ?, phone = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [nextDisplayName, nextRole, nextStatus, nextPhone, input.id]
  );

  const refreshed = await findDbUserById(input.id);
  return refreshed ? toAdminUserProfile(refreshed) : null;
}

export async function changeAdminUserPassword(
  userId: string,
  currentPassword: string,
  nextPassword: string
): Promise<ChangeAdminUserPasswordResult> {
  await ensureAdminUserStore();
  const user = await getAdminUserById(userId);
  if (!user || user.status !== "active") return "not_found";

  const validCurrent = await verifyPassword(currentPassword, user.passwordHash);
  if (!validCurrent) return "invalid_current";

  const nextHash = await hashPassword(nextPassword);
  const passwordChangedAt = new Date().toISOString();

  if (!hasMysqlConfig()) {
    const now = new Date().toISOString();
    for (const [email, stored] of memoryUsers) {
      if (stored.id !== userId) continue;
      memoryUsers.set(email, {
        ...stored,
        passwordHash: nextHash,
        passwordChangedAt,
        updatedAt: now,
      });
      return "ok";
    }
    return "not_found";
  }

  const pool = await getMysqlPool();
  await pool.execute(
    "UPDATE admin_users SET password_hash = ?, password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [nextHash, userId]
  );
  return "ok";
}

export async function revokeAdminUserOtherSessions(userId: string): Promise<RevokeAdminUserSessionsResult> {
  await ensureAdminUserStore();
  const user = await getAdminUserById(userId);
  if (!user || user.status !== "active") return "not_found";

  const passwordChangedAt = new Date().toISOString();

  if (!hasMysqlConfig()) {
    for (const [email, stored] of memoryUsers) {
      if (stored.id !== userId) continue;
      memoryUsers.set(email, {
        ...stored,
        passwordChangedAt,
        updatedAt: new Date().toISOString(),
      });
      return "ok";
    }
    return "not_found";
  }

  const pool = await getMysqlPool();
  await pool.execute(
    "UPDATE admin_users SET password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [userId]
  );
  return "ok";
}

export function resetAdminUserStoreForTests(): void {
  initialized = false;
  memoryUsers.clear();
  poolPromise = null;
}
