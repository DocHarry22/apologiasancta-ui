import { randomUUID } from "node:crypto";
import {
  convertToPostgresPlaceholders,
  getAdminDatabaseDialect,
  hasAdminUserStoreConfiguration,
  type AdminDatabaseDialect,
} from "@/lib/auth/databaseConfig";
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

type DatabasePool = {
  execute: (sql: string, values?: unknown[]) => Promise<[unknown[], unknown]>;
};

let poolPromise: Promise<DatabasePool> | null = null;
let initializationPromise: Promise<void> | null = null;
let initialized = false;
const memoryUsers = new Map<string, AdminUser>();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hasDatabaseConfig(): boolean {
  return getAdminDatabaseDialect() !== null;
}

function getPostgresAdminSchema(): string {
  const configured = process.env.ADMIN_DB_SCHEMA?.trim() || "private";
  if (!/^[a-z_][a-z0-9_]*$/i.test(configured)) {
    throw new Error("ADMIN_DB_SCHEMA must be a simple PostgreSQL identifier.");
  }
  return configured;
}

function getAdminTableName(dialect: AdminDatabaseDialect = getAdminDatabaseDialect() ?? "mysql"): string {
  return dialect === "postgres"
    ? `"${getPostgresAdminSchema()}"."admin_users"`
    : "admin_users";
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

async function getDatabasePool(): Promise<DatabasePool> {
  if (poolPromise) return poolPromise;

  const pendingPool: Promise<DatabasePool> = (async () => {
    const dialect = getAdminDatabaseDialect();
    if (!dialect) {
      throw new Error("Admin user database configuration is missing or uses an unsupported URL scheme.");
    }

    if (dialect === "postgres") {
      // Keep driver imports statically traceable so Next.js includes them in
      // the standalone production bundle used by Hostinger.
      const postgres = await import("pg");
      const postgresPool = new postgres.Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10_000),
      });
      return {
        async execute(sql: string, values?: unknown[]): Promise<[unknown[], unknown]> {
          const result = await postgresPool.query(convertToPostgresPlaceholders(sql), values);
          return [result.rows, []];
        },
      };
    }

    const mysql = await import("mysql2/promise");
    if (process.env.DATABASE_URL) {
      return mysql.createPool(process.env.DATABASE_URL) as unknown as DatabasePool;
    }

    return mysql.createPool({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT || 3306),
      database: process.env.MYSQL_DATABASE,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      waitForConnections: true,
      connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 5),
      connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10_000),
      enableKeepAlive: true,
    }) as unknown as DatabasePool;
  })();
  poolPromise = pendingPool;

  try {
    return await pendingPool;
  } catch (error) {
    if (poolPromise === pendingPool) poolPromise = null;
    throw error;
  }
}

async function ensureSchema(): Promise<void> {
  const pool = await getDatabasePool();
  const dialect: AdminDatabaseDialect = getAdminDatabaseDialect() ?? "mysql";
  const tableName = getAdminTableName(dialect);

  if (dialect === "postgres") {
    const schemaName = getPostgresAdminSchema();
    await pool.execute(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    await pool.execute(`REVOKE ALL ON SCHEMA "${schemaName}" FROM PUBLIC`);
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        role VARCHAR(32) NOT NULL,
        account_type VARCHAR(32) NOT NULL DEFAULT 'staff',
        phone VARCHAR(64) NULL,
        password_changed_at TIMESTAMPTZ NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMPTZ NULL
      )
    `);
    await pool.execute(`CREATE INDEX IF NOT EXISTS idx_admin_users_email ON ${tableName} (email)`);
    await pool.execute(`CREATE INDEX IF NOT EXISTS idx_admin_users_status ON ${tableName} (status)`);
    await pool.execute(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS account_type VARCHAR(32) NOT NULL DEFAULT 'staff'`);
    await pool.execute(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS phone VARCHAR(64) NULL`);
    await pool.execute(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ NULL`);
    await pool.execute(`REVOKE ALL ON TABLE ${tableName} FROM PUBLIC`);
    await pool.execute(`
      DO $$
      DECLARE exposed_role text;
      BEGIN
        FOR exposed_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
          EXECUTE format('REVOKE ALL ON TABLE ${tableName} FROM %I', exposed_role);
        END LOOP;
      END $$
    `);

    // One-way compatibility copy for deployments that previously created the
    // credential table in Supabase's Data API-exposed public schema. The old
    // table is retained for rollback, but browser-facing database roles are
    // explicitly denied and RLS defaults to no access.
    if (schemaName !== "public") {
      await pool.execute(`
        DO $$
        DECLARE exposed_role text;
        BEGIN
          IF to_regclass('public.admin_users') IS NOT NULL THEN
            EXECUTE 'ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS account_type VARCHAR(32) NOT NULL DEFAULT ''staff''';
            EXECUTE 'ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS phone VARCHAR(64) NULL';
            EXECUTE 'ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ NULL';
            INSERT INTO ${tableName} (
              id, email, password_hash, display_name, role, account_type, phone,
              password_changed_at, status, created_at, updated_at, last_login_at
            )
            SELECT id, email, password_hash, display_name, role, account_type,
              phone, password_changed_at, status, created_at, updated_at, last_login_at
            FROM public.admin_users
            ON CONFLICT (id) DO NOTHING;
            EXECUTE 'REVOKE ALL ON TABLE public.admin_users FROM PUBLIC';
            FOR exposed_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
              EXECUTE format('REVOKE ALL ON TABLE public.admin_users FROM %I', exposed_role);
            END LOOP;
            EXECUTE 'ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY';
          END IF;
        END $$
      `);
    }
    return;
  }

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
  const pool = await getDatabasePool();
  const [rows] = await pool.execute(`SELECT * FROM ${getAdminTableName()} WHERE email = ? LIMIT 1`, [normalizeEmail(email)]);
  const first = (rows as Record<string, unknown>[])[0];
  return first ? rowToUser(first) : null;
}

async function findDbUserById(id: string): Promise<AdminUser | null> {
  const pool = await getDatabasePool();
  const [rows] = await pool.execute(`SELECT * FROM ${getAdminTableName()} WHERE id = ? LIMIT 1`, [id]);
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
  const pool = await getDatabasePool();
  const [rows] = await pool.execute(`SELECT * FROM ${getAdminTableName()} ORDER BY created_at DESC`);
  return (rows as Record<string, unknown>[]).map(rowToUser);
}

async function countActiveSuperAdmins(): Promise<number> {
  if (!hasDatabaseConfig()) {
    let count = 0;
    for (const user of memoryUsers.values()) {
      if (user.status === "active" && user.role === "super_admin") count += 1;
    }
    return count;
  }

  const pool = await getDatabasePool();
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS count FROM ${getAdminTableName()} WHERE role = 'super_admin' AND status = 'active'`
  );
  const first = (rows as Array<{ count?: number | string }>)[0];
  return Number(first?.count ?? 0);
}

async function upsertSeedAdmin(): Promise<void> {
  if (process.env.NODE_ENV === "production" && process.env.ADMIN_BOOTSTRAP_ENABLED !== "true") return;
  const email = normalizeEmail(process.env.ADMIN_EMAIL || "");
  const password = process.env.ADMIN_PASSWORD || "";
  if (!email || !password) return;

  const role = getSeedRole();
  const displayName = getSeedDisplayName(email);
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  if (!hasDatabaseConfig()) {
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
  const pool = await getDatabasePool();

  if (existing) {
    const passwordSql = process.env.ADMIN_BOOTSTRAP_OVERWRITE_PASSWORD === "true" ? ", password_hash = ?" : "";
    const values: unknown[] = process.env.ADMIN_BOOTSTRAP_OVERWRITE_PASSWORD === "true"
      ? [displayName, role, "active", await hashPassword(password), email]
      : [displayName, role, "active", email];
    await pool.execute(
      `UPDATE ${getAdminTableName()} SET display_name = ?, role = ?, status = ?, updated_at = CURRENT_TIMESTAMP${passwordSql} WHERE email = ?`,
      values
    );
    return;
  }

  await pool.execute(
    `INSERT INTO ${getAdminTableName()} (id, email, password_hash, display_name, role, account_type, phone, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'staff', NULL, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [randomUUID(), email, await hashPassword(password), displayName, role]
  );
}

export async function ensureAdminUserStore(): Promise<void> {
  if (initialized) return;
  if (initializationPromise) return initializationPromise;

  const pendingInitialization = (async () => {
    if (!hasAdminUserStoreConfiguration()) {
      throw new Error("Admin user database is not configured. Set a PostgreSQL or MySQL DATABASE_URL, or MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER, and MYSQL_PASSWORD.");
    }

    if (hasDatabaseConfig()) {
      await ensureSchema();
    }
    await upsertSeedAdmin();
    initialized = true;
  })();
  initializationPromise = pendingInitialization;

  try {
    await pendingInitialization;
  } catch (error) {
    if (initializationPromise === pendingInitialization) initializationPromise = null;
    throw error;
  }
}

export async function getAdminUserById(id: string): Promise<AdminUser | null> {
  await ensureAdminUserStore();
  if (!hasDatabaseConfig()) {
    return Array.from(memoryUsers.values()).find((user) => user.id === id) ?? null;
  }
  return findDbUserById(id);
}

export async function authenticateAdminUser(email: string, password: string): Promise<AdminUser | null> {
  await ensureAdminUserStore();
  const normalizedEmail = normalizeEmail(email);
  const user = hasDatabaseConfig()
    ? await findDbUserByEmail(normalizedEmail)
    : memoryUsers.get(normalizedEmail) ?? null;

  if (!user || user.status !== "active") return null;
  if (!(await verifyPassword(password, user.passwordHash))) return null;

  await markAdminUserLogin(user.id);
  return { ...user, lastLoginAt: new Date().toISOString() };
}

export async function markAdminUserLogin(id: string): Promise<void> {
  if (!hasDatabaseConfig()) {
    for (const [email, user] of memoryUsers) {
      if (user.id === id) {
        memoryUsers.set(email, { ...user, lastLoginAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        return;
      }
    }
    return;
  }

  const pool = await getDatabasePool();
  await pool.execute(`UPDATE ${getAdminTableName()} SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
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

  const existing = hasDatabaseConfig()
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

  if (!hasDatabaseConfig()) {
    memoryUsers.set(email, created);
    return created;
  }

  const pool = await getDatabasePool();
  await pool.execute(
    `INSERT INTO ${getAdminTableName()} (id, email, password_hash, display_name, role, account_type, phone, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [created.id, created.email, created.passwordHash, created.displayName, created.role, created.accountType, created.phone]
  );

  return created;
}

export async function listAdminUsers(): Promise<AdminUserProfile[]> {
  await ensureAdminUserStore();
  const users = hasDatabaseConfig() ? await listDbUsers() : Array.from(memoryUsers.values());
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

  if (!hasDatabaseConfig()) {
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

  const pool = await getDatabasePool();
  await pool.execute(
    `UPDATE ${getAdminTableName()}
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

  if (!hasDatabaseConfig()) {
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

  const pool = await getDatabasePool();
  await pool.execute(
    `UPDATE ${getAdminTableName()} SET password_hash = ?, password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [nextHash, userId]
  );
  return "ok";
}

export async function revokeAdminUserOtherSessions(userId: string): Promise<RevokeAdminUserSessionsResult> {
  await ensureAdminUserStore();
  const user = await getAdminUserById(userId);
  if (!user || user.status !== "active") return "not_found";

  const passwordChangedAt = new Date().toISOString();

  if (!hasDatabaseConfig()) {
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

  const pool = await getDatabasePool();
  await pool.execute(
    `UPDATE ${getAdminTableName()} SET password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [userId]
  );
  return "ok";
}

export function resetAdminUserStoreForTests(): void {
  initialized = false;
  initializationPromise = null;
  memoryUsers.clear();
  poolPromise = null;
}
