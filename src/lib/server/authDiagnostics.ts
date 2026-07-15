import { randomUUID } from "node:crypto";
import {
  getAdminAuthConfigurationReport,
  type AdminAuthConfigurationReport,
} from "@/lib/auth/availability";
import { ensureAdminUserStore } from "./adminUserStore";

export type AuthDiagnosticReason =
  | "ready"
  | "session_secret_missing"
  | "database_configuration_missing"
  | "database_url_invalid"
  | "database_access_denied"
  | "database_permission_denied"
  | "database_not_found"
  | "database_host_not_found"
  | "database_connection_refused"
  | "database_connection_timeout"
  | "database_tls_failed"
  | "database_schema_incompatible"
  | "database_initialization_failed";

type ErrorWithDatabaseMetadata = Error & {
  code?: string;
  errno?: number;
  sqlState?: string;
};

export interface AuthDiagnosticResult {
  diagnosticId: string;
  ok: boolean;
  reason: AuthDiagnosticReason;
  configuration: AdminAuthConfigurationReport;
  driverCode: string | null;
}

interface RecordAuthFailureOptions {
  operation: string;
  error?: unknown;
  configuration?: AdminAuthConfigurationReport;
}

function errorMetadata(error: unknown): {
  code: string | null;
  errno: number | null;
  sqlState: string | null;
  name: string;
} {
  if (!(error instanceof Error)) {
    return { code: null, errno: null, sqlState: null, name: "UnknownError" };
  }

  const databaseError = error as ErrorWithDatabaseMetadata;
  return {
    code: typeof databaseError.code === "string" ? databaseError.code : null,
    errno: typeof databaseError.errno === "number" ? databaseError.errno : null,
    sqlState: typeof databaseError.sqlState === "string" ? databaseError.sqlState : null,
    name: error.name || "Error",
  };
}

export function classifyAuthFailure(
  configuration: AdminAuthConfigurationReport,
  error?: unknown
): AuthDiagnosticReason {
  if (!configuration.sessionConfigured) return "session_secret_missing";
  if (configuration.databaseUrlPresent && !configuration.databaseUrlSupported) {
    return "database_url_invalid";
  }
  if (!configuration.userStoreConfigured) return "database_configuration_missing";
  if (!error) return "database_initialization_failed";

  const metadata = errorMetadata(error);
  const code = metadata.code?.toUpperCase() ?? "";
  const message = error instanceof Error ? error.message.toUpperCase() : "";

  if (
    code === "ER_ACCESS_DENIED_ERROR" ||
    code === "28P01" ||
    metadata.errno === 1045
  ) {
    return "database_access_denied";
  }
  if (
    code === "ER_DBACCESS_DENIED_ERROR" ||
    code === "ER_TABLEACCESS_DENIED_ERROR" ||
    code === "ER_SPECIFIC_ACCESS_DENIED_ERROR" ||
    code === "42501" ||
    metadata.errno === 1044 ||
    metadata.errno === 1142
  ) {
    return "database_permission_denied";
  }
  if (code === "ER_BAD_DB_ERROR" || code === "3D000" || metadata.errno === 1049) {
    return "database_not_found";
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return "database_host_not_found";
  }
  if (code === "ECONNREFUSED" || code === "08001") {
    return "database_connection_refused";
  }
  if (
    code === "ETIMEDOUT" ||
    code === "08006" ||
    code === "57P01" ||
    code === "PROTOCOL_CONNECTION_LOST" ||
    code === "PROTOCOL_SEQUENCE_TIMEOUT"
  ) {
    return "database_connection_timeout";
  }
  if (
    code.includes("SSL") ||
    code.includes("CERT") ||
    message.includes("TLS") ||
    message.includes("CERTIFICATE")
  ) {
    return "database_tls_failed";
  }
  if (
    code === "ER_PARSE_ERROR" ||
    code === "ER_SYNTAX_ERROR" ||
    metadata.errno === 1064
  ) {
    return "database_schema_incompatible";
  }

  return "database_initialization_failed";
}

function safeConfigurationForLog(configuration: AdminAuthConfigurationReport) {
  return {
    ready: configuration.ready,
    sessionConfigured: configuration.sessionConfigured,
    userStoreConfigured: configuration.userStoreConfigured,
    databaseDialect: configuration.databaseDialect,
    databaseSource: configuration.databaseSource,
    databaseUrlPresent: configuration.databaseUrlPresent,
    databaseUrlSupported: configuration.databaseUrlSupported,
    missingVariables: configuration.missingVariables,
    bootstrapEmailConfigured: configuration.bootstrapEmailConfigured,
    bootstrapPasswordConfigured: configuration.bootstrapPasswordConfigured,
  };
}

export function recordAuthFailure({
  operation,
  error,
  configuration = getAdminAuthConfigurationReport(),
}: RecordAuthFailureOptions): AuthDiagnosticResult {
  const diagnosticId = randomUUID();
  const metadata = errorMetadata(error);
  const reason = classifyAuthFailure(configuration, error);
  const result: AuthDiagnosticResult = {
    diagnosticId,
    ok: false,
    reason,
    configuration,
    driverCode: metadata.code,
  };

  // Intentionally omit error messages, hostnames, usernames, URLs and values.
  console.error(JSON.stringify({
    event: "admin_auth_unavailable",
    diagnosticId,
    operation,
    reason,
    configuration: safeConfigurationForLog(configuration),
    driver: metadata,
  }));

  return result;
}

export async function runAuthDiagnostic(): Promise<AuthDiagnosticResult> {
  const configuration = getAdminAuthConfigurationReport();
  if (!configuration.ready) {
    return recordAuthFailure({ operation: "diagnostic.readiness", configuration });
  }

  try {
    await ensureAdminUserStore();
    return {
      diagnosticId: randomUUID(),
      ok: true,
      reason: "ready",
      configuration,
      driverCode: null,
    };
  } catch (error) {
    return recordAuthFailure({
      operation: "diagnostic.initialize_user_store",
      error,
      configuration,
    });
  }
}
