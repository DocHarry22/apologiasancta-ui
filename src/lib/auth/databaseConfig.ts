export type AdminDatabaseDialect = "mysql" | "postgres";

type DatabaseEnvironment = Record<string, string | undefined>;

export function getAdminDatabaseDialect(
  environment: DatabaseEnvironment = process.env
): AdminDatabaseDialect | null {
  const databaseUrl = environment.DATABASE_URL?.trim();
  if (databaseUrl) {
    if (/^postgres(?:ql)?:\/\//i.test(databaseUrl)) return "postgres";
    if (/^mysql:\/\//i.test(databaseUrl)) return "mysql";
    return null;
  }

  if (
    environment.MYSQL_HOST &&
    environment.MYSQL_DATABASE &&
    environment.MYSQL_USER &&
    environment.MYSQL_PASSWORD
  ) {
    return "mysql";
  }

  return null;
}

export function hasAdminUserStoreConfiguration(
  environment: DatabaseEnvironment = process.env
): boolean {
  if (getAdminDatabaseDialect(environment)) return true;

  return (
    environment.NODE_ENV !== "production" ||
    environment.ADMIN_AUTH_MEMORY_STORE === "true"
  );
}

export function convertToPostgresPlaceholders(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}
