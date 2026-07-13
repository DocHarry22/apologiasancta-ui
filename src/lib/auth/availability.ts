import { hasAdminUserStoreConfiguration } from "./databaseConfig";

export const AUTH_UNAVAILABLE_CODE = "auth_unavailable";
export const AUTH_RETRY_AFTER_SECONDS = 300;

type AuthEnvironment = Record<string, string | undefined>;

export interface AdminAuthReadiness {
  ready: boolean;
  sessionConfigured: boolean;
  userStoreConfigured: boolean;
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
