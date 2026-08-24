import { convertToPostgresPlaceholders, getAdminDatabaseDialect } from "@/lib/auth/databaseConfig";
import { withLearningTransaction } from "@/lib/server/learning/database";

export type DeletePublicAccountResult =
  | { ok: true; learningProfileDeleted: boolean }
  | { ok: false; reason: "admin_store_unavailable" | "account_not_found" };

function getPostgresAdminSchema(): string {
  const configured = process.env.ADMIN_DB_SCHEMA?.trim() || "private";
  if (!/^[a-z_][a-z0-9_]*$/i.test(configured)) {
    throw new Error("ADMIN_DB_SCHEMA must be a simple PostgreSQL identifier.");
  }
  return configured;
}

function getAdminTableName(): string {
  return getAdminDatabaseDialect() === "postgres"
    ? `"${getPostgresAdminSchema()}"."admin_users"`
    : "admin_users";
}

async function deleteLearningProfile(authUserId: string): Promise<boolean> {
  return withLearningTransaction(async (client) => {
    const profileResult = await client.query<{ id: string }>(
      `SELECT id
         FROM public.learner_profiles
        WHERE identity_provider = 'apologia_session'
          AND external_subject = $1
        FOR UPDATE`,
      [authUserId.slice(0, 255)],
    );
    const learnerId = profileResult.rows[0]?.id;
    if (!learnerId) return false;

    // This transaction is initiated only after the authenticated public learner
    // has passed CSRF and typed-confirmation checks in DELETE /api/auth/me.
    // SET LOCAL keeps the exceptional unlock-deletion permission scoped to
    // this transaction and resets it automatically on COMMIT/ROLLBACK.
    await client.query(`SELECT set_config('app.maintenance_context', 'account_deletion', true)`);

    // Preserve aggregate/live-quiz integrity without retaining the learner's
    // account link, display name, external participant key, or metadata.
    await client.query(
      `UPDATE game.room_participants
          SET learner_id = NULL,
              display_name = 'Deleted learner',
              external_participant_key = 'deleted:' || id::text,
              metadata = '{}'::jsonb,
              last_seen_at = now()
        WHERE learner_id = $1`,
      [learnerId],
    );

    // Phase 2 learner tables can retain restrictive references to mastery
    // attempts, so clear those references before deleting attempts.
    await client.query(`DELETE FROM public.question_exposures WHERE learner_id = $1`, [learnerId]);
    await client.query(`DELETE FROM public.corrective_recommendations WHERE learner_id = $1`, [learnerId]);
    await client.query(`DELETE FROM public.retention_reviews WHERE learner_id = $1`, [learnerId]);

    // Delete learner-linked evidence before mastery attempts because several
    // assessment tables intentionally use restrictive foreign keys.
    await client.query(`DELETE FROM public.learner_node_mastery_evidence WHERE learner_id = $1`, [learnerId]);
    await client.query(`DELETE FROM public.learner_node_mastery WHERE learner_id = $1`, [learnerId]);
    await client.query(`DELETE FROM public.mastery_answers WHERE learner_id = $1`, [learnerId]);

    // These rows may reference mastery attempts through RESTRICT foreign keys.
    // Unlock deletion is permitted only by the scoped account_deletion context
    // installed above; ordinary application flows remain append-only.
    await client.query(`DELETE FROM public.unlocks WHERE learner_id = $1`, [learnerId]);
    await client.query(`DELETE FROM public.group_progress WHERE learner_id = $1`, [learnerId]);

    await client.query(`DELETE FROM public.review_schedule WHERE learner_id = $1`, [learnerId]);
    await client.query(`DELETE FROM public.bookmarks WHERE learner_id = $1`, [learnerId]);
    await client.query(`DELETE FROM public.lesson_progress WHERE learner_id = $1`, [learnerId]);
    await client.query(
      `DELETE FROM public.mastery_attempt_questions
        WHERE attempt_id IN (SELECT id FROM public.mastery_attempts WHERE learner_id = $1)`,
      [learnerId],
    );
    await client.query(`DELETE FROM public.mastery_attempts WHERE learner_id = $1`, [learnerId]);
    await client.query(`DELETE FROM public.learner_profiles WHERE id = $1`, [learnerId]);
    return true;
  });
}

async function deleteAdminAccount(userId: string): Promise<boolean> {
  const dialect = getAdminDatabaseDialect();
  if (!dialect) return false;
  const tableName = getAdminTableName();

  if (dialect === "postgres") {
    const postgres = await import("pg");
    const pool = new postgres.Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10_000),
      max: 1,
    });
    try {
      const result = await pool.query(
        convertToPostgresPlaceholders(`DELETE FROM ${tableName} WHERE id = ? AND account_type = 'public'`),
        [userId],
      );
      return (result.rowCount ?? 0) === 1;
    } finally {
      await pool.end();
    }
  }

  const mysql = await import("mysql2/promise");
  const connection = process.env.DATABASE_URL
    ? await mysql.createConnection(process.env.DATABASE_URL)
    : await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        port: Number(process.env.MYSQL_PORT || 3306),
        database: process.env.MYSQL_DATABASE,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10_000),
      });
  try {
    const [result] = await connection.execute(
      `DELETE FROM ${tableName} WHERE id = ? AND account_type = 'public'`,
      [userId],
    );
    return Number((result as { affectedRows?: number }).affectedRows ?? 0) === 1;
  } finally {
    await connection.end();
  }
}

/**
 * Permanently removes a public learner account and its account-linked learning
 * data. Learning data is removed first so a transient learning-store failure
 * cannot strand undeletable data after authentication has disappeared.
 */
export async function deletePublicAccount(userId: string): Promise<DeletePublicAccountResult> {
  if (!getAdminDatabaseDialect()) {
    return { ok: false, reason: "admin_store_unavailable" };
  }

  const learningProfileDeleted = await deleteLearningProfile(userId);
  const adminDeleted = await deleteAdminAccount(userId);
  if (!adminDeleted) {
    return { ok: false, reason: "account_not_found" };
  }

  return { ok: true, learningProfileDeleted };
}
