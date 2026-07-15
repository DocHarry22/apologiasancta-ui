export type AdminDatabaseDialect = "mysql" | "postgres";
export type AdminDatabaseSource = "database_url" | "mysql_variables" | "memory_store" | "none";

type DatabaseEnvironment = Record<string, string | undefined>;

const MYSQL_REQUIRED_VARIABLES = [
  "MYSQL_HOST",
  "MYSQL_DATABASE",
  "MYSQL_USER",
  "MYSQL_PASSWORD",
] as const;

export interface AdminDatabaseConfigurationSummary {
  configured: boolean;
  dialect: AdminDatabaseDialect | null;
  source: AdminDatabaseSource;
  databaseUrlPresent: boolean;
  databaseUrlSupported: boolean;
  missingVariables: string[];
}

export function getAdminDatabaseConfigurationSummary(
  environment: DatabaseEnvironment = process.env
): AdminDatabaseConfigurationSummary {
  const databaseUrl = environment.DATABASE_URL?.trim();
  if (databaseUrl) {
    const dialect = /^postgres(?:ql)?:\/\//i.test(databaseUrl)
      ? "postgres"
      : /^mysql:\/\//i.test(databaseUrl)
        ? "mysql"
        : null;

    return {
      configured: dialect !== null,
      dialect,
      source: "database_url",
      databaseUrlPresent: true,
      databaseUrlSupported: dialect !== null,
      missingVariables: [],
    };
  }

  const missingVariables = MYSQL_REQUIRED_VARIABLES.filter(
    (key) => !environment[key]?.trim()
  );
  if (missingVariables.length === 0) {
    return {
      configured: true,
      dialect: "mysql",
      source: "mysql_variables",
      databaseUrlPresent: false,
      databaseUrlSupported: true,
      missingVariables: [],
    };
  }

  if (
    environment.NODE_ENV !== "production" ||
    environment.ADMIN_AUTH_MEMORY_STORE === "true"
  ) {
    return {
      configured: true,
      dialect: null,
      source: "memory_store",
      databaseUrlPresent: false,
      databaseUrlSupported: true,
      missingVariables,
    };
  }

  return {
    configured: false,
    dialect: null,
    source: "none",
    databaseUrlPresent: false,
    databaseUrlSupported: true,
    missingVariables,
  };
}

export function getAdminDatabaseDialect(
  environment: DatabaseEnvironment = process.env
): AdminDatabaseDialect | null {
  return getAdminDatabaseConfigurationSummary(environment).dialect;
}

export function hasAdminUserStoreConfiguration(
  environment: DatabaseEnvironment = process.env
): boolean {
  return getAdminDatabaseConfigurationSummary(environment).configured;
}

export function convertToPostgresPlaceholders(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}
