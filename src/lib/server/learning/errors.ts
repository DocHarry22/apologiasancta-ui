import { LearningValidationError } from "@/lib/learning/validation";

export class LearningApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields?: Record<string, string>;

  constructor(code: string, status: number, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "LearningApiError";
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

type PostgresLikeError = {
  code?: unknown;
  constraint?: unknown;
};

export function normalizeLearningError(error: unknown): LearningApiError {
  if (error instanceof LearningApiError) return error;
  if (error instanceof LearningValidationError) {
    return new LearningApiError("invalid_request", 400, error.message, error.fields);
  }

  const postgres = error && typeof error === "object" ? error as PostgresLikeError : null;
  switch (postgres?.code) {
    case "23503":
      return new LearningApiError("invalid_reference", 400, "A referenced learning record does not exist.");
    case "23505":
      return new LearningApiError("conflict", 409, "A conflicting learning record already exists.");
    case "23514":
    case "22P02":
    case "22023":
      return new LearningApiError("invalid_request", 400, "The request could not be accepted.");
    case "40001":
    case "40P01":
      return new LearningApiError("retry_required", 409, "The request conflicted with another update. Please retry.");
    case "57014":
    case "57P01":
    case "08000":
    case "08001":
    case "08003":
    case "08006":
      return new LearningApiError("learning_service_unavailable", 503, "The learning service is temporarily unavailable.");
    case "42501":
      return new LearningApiError("forbidden", 403, "You do not have permission to perform this learning operation.");
    case "P0001":
      return new LearningApiError("operation_rejected", 409, "The learning operation could not be completed.");
    default:
      return new LearningApiError("learning_service_unavailable", 503, "The learning service is temporarily unavailable.");
  }
}

export function notFound(resource = "Learning content"): LearningApiError {
  return new LearningApiError("not_found", 404, `${resource} was not found.`);
}
