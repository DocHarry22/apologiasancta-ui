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

export function convertToPostgresPlaceholders(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}
