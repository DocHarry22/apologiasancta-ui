import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import { hasPermission, type Permission } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/server/currentUser";
import { requireAuthorSession, requireCsrf } from "@/lib/server/apiAuth";
import { learningQuery } from "./database";
import { LearningApiError } from "./errors";
import { errorResponse } from "./responses";
import { serializeLearningRow } from "./serialize";

export type LearnerProfile = {
  id: string;
  identityProvider: string;
  externalSubject: string;
  displayName: string;
  locale: string | null;
  timezone: string | null;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
};

export type LearnerContext = {
  user: CurrentUser;
  learner: LearnerProfile;
};

export type StaffContext = {
  user: CurrentUser;
};

type AuthResult<T> = { ok: true; context: T } | { ok: false; response: NextResponse };

async function sessionUser(request: NextRequest): Promise<AuthResult<{ user: CurrentUser }>> {
  try {
    const auth = await requireAuthorSession(request);
    if (!auth.ok) {
      return {
        ok: false,
        response: errorResponse(new LearningApiError("unauthorized", 401, "Authentication is required.")),
      };
    }
    return { ok: true, context: { user: auth.user } };
  } catch {
    return {
      ok: false,
      response: errorResponse(new LearningApiError("unauthorized", 401, "Authentication is required.")),
    };
  }
}

async function validateMutationCsrf(request: NextRequest, user: CurrentUser): Promise<NextResponse | null> {
  const csrfFailure = await requireCsrf(request, user);
  if (!csrfFailure) return null;
  return errorResponse(new LearningApiError("csrf_failed", 403, "CSRF validation failed."));
}

export async function requireLearnerContext(
  request: NextRequest,
  options: { mutation?: boolean } = {},
): Promise<AuthResult<LearnerContext>> {
  const auth = await sessionUser(request);
  if (!auth.ok) return auth;
  if (options.mutation) {
    const csrfFailure = await validateMutationCsrf(request, auth.context.user);
    if (csrfFailure) return { ok: false, response: csrfFailure };
  }

  const externalSubject = auth.context.user.id.slice(0, 255);
  const displayName = auth.context.user.displayName.trim().slice(0, 160) || "Learner";
  const result = await learningQuery<Record<string, unknown>>(
    `INSERT INTO public.learner_profiles
       (identity_provider, external_subject, display_name, last_seen_at)
     VALUES ('apologia_session', $1, $2, now())
     ON CONFLICT (identity_provider, external_subject) WHERE external_subject IS NOT NULL
     DO UPDATE SET
       display_name = EXCLUDED.display_name,
       last_seen_at = now(),
       updated_at = CASE
         WHEN learner_profiles.display_name IS DISTINCT FROM EXCLUDED.display_name THEN now()
         ELSE learner_profiles.updated_at
       END
     RETURNING id, identity_provider, external_subject, display_name, locale, timezone,
               settings, created_at, updated_at, last_seen_at`,
    [externalSubject, displayName],
  );
  const learner = result.rows[0];
  if (!learner) throw new LearningApiError("learning_service_unavailable", 503, "The learning service is temporarily unavailable.");
  return {
    ok: true,
    context: {
      user: auth.context.user,
      learner: serializeLearningRow<LearnerProfile>(learner),
    },
  };
}

export async function requireStaffContext(
  request: NextRequest,
  permission: Permission,
  options: { mutation?: boolean } = {},
): Promise<AuthResult<StaffContext>> {
  const auth = await sessionUser(request);
  if (!auth.ok) return auth;
  const { user } = auth.context;
  if (user.accountType !== "staff" || !hasPermission(user.role, permission)) {
    return {
      ok: false,
      response: errorResponse(new LearningApiError("forbidden", 403, "You do not have permission to perform this action.")),
    };
  }
  if (options.mutation) {
    const csrfFailure = await validateMutationCsrf(request, user);
    if (csrfFailure) return { ok: false, response: csrfFailure };
  }
  return { ok: true, context: { user } };
}
