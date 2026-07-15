import {
  getAdminDatabaseConfigurationSummary,
  hasAdminUserStoreConfiguration,
  type AdminDatabaseDialect,
  type AdminDatabaseSource,
} from "./databaseConfig";

export const AUTH_UNAVAILABLE_CODE = "auth_unavailable";
export const AUTH_RETRY_AFTER_SECONDS = 300;

type AuthEnvironment = Record<string, string | undefined>;

export interface AdminAuthReadiness {
  ready: boolean;
  sessionConfigured: boolean;
  userStoreConfigured: boolean;
}

export interface AdminAuthConfigurationReport extends AdminAuthReadiness {
  databaseDialect: AdminDatabaseDialect | null;
  databaseSource: AdminDatabaseSource;
  databaseUrlPresent: boolean;
  databaseUrlSupported: boolean;
  missingVariables: string[];
  bootstrapEmailConfigured: boolean;
  bootstrapPasswordConfigured: boolean;
}

export function getAdminAuthReadiness(
  environment: AuthEnvironment = process.env
): AdminAuthReadiness {
  const sessionConfigured = Boolean(environment.AUTHOR_SESSION_SECRET?.trim());
  const userStoreConfigured = hasAdminUserStoreConfiguration(environment);

  return {
    ready: sessionConfigured && userStoreConfigured,
    sessionConfigured,
    userStoreConfigured,
  };
}

export function getAdminAuthConfigurationReport(
  environment: AuthEnvironment = process.env
): AdminAuthConfigurationReport {
  const readiness = getAdminAuthReadiness(environment);
  const database = getAdminDatabaseConfigurationSummary(environment);

  const missingVariables = [...database.missingVariables];
  if (!readiness.sessionConfigured) missingVariables.unshift("AUTHOR_SESSION_SECRET");

  return {
    ...readiness,
    databaseDialect: database.dialect,
    databaseSource: database.source,
    databaseUrlPresent: database.databaseUrlPresent,
    databaseUrlSupported: database.databaseUrlSupported,
    missingVariables,
    bootstrapEmailConfigured: Boolean(environment.ADMIN_EMAIL?.trim()),
    bootstrapPasswordConfigured: Boolean(environment.ADMIN_PASSWORD),
  };
}
