export type LearningProgressDialect = "postgres" | "mysql";

export const LEARNING_PROGRESS_MIGRATION_ID = "2026071601_authenticated_learning_progress";

/**
 * Repeatable DDL. Every statement is safe to re-run after a partial deploy.
 * `admin_users` is deliberately the identity authority and must exist first.
 */
export function getLearningProgressMigrationStatements(dialect: LearningProgressDialect): string[] {
  if (dialect === "postgres") {
    return [
      `CREATE TABLE IF NOT EXISTS app_schema_migrations (
        migration_id VARCHAR(128) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS learning_profiles (
        account_id VARCHAR(64) PRIMARY KEY REFERENCES admin_users(id) ON DELETE CASCADE,
        revision BIGINT NOT NULL DEFAULT 0 CHECK (revision >= 0),
        practice_best INTEGER NOT NULL DEFAULT 0 CHECK (practice_best >= 0),
        practice_attempts BIGINT NOT NULL DEFAULT 0 CHECK (practice_attempts >= 0),
        client_updated_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      "CREATE INDEX IF NOT EXISTS idx_learning_profiles_updated_at ON learning_profiles (updated_at DESC)",
      `CREATE TABLE IF NOT EXISTS learning_lesson_progress (
        account_id VARCHAR(64) NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
        lesson_id VARCHAR(128) NOT NULL,
        completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (account_id, lesson_id)
      )`,
      "CREATE INDEX IF NOT EXISTS idx_learning_lessons_account_updated ON learning_lesson_progress (account_id, updated_at DESC)",
      `CREATE TABLE IF NOT EXISTS learning_progress_mutations (
        account_id VARCHAR(64) NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
        mutation_id VARCHAR(80) NOT NULL,
        mutation_type VARCHAR(32) NOT NULL CHECK (mutation_type = 'practice_attempt'),
        score INTEGER NOT NULL CHECK (score >= 0),
        occurred_at TIMESTAMPTZ NOT NULL,
        applied_revision BIGINT NOT NULL CHECK (applied_revision >= 0),
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (account_id, mutation_id)
      )`,
      "CREATE INDEX IF NOT EXISTS idx_learning_mutations_account_applied ON learning_progress_mutations (account_id, applied_at DESC)",
      `INSERT INTO app_schema_migrations (migration_id, applied_at)
       VALUES ('${LEARNING_PROGRESS_MIGRATION_ID}', CURRENT_TIMESTAMP)
       ON CONFLICT (migration_id) DO NOTHING`,
    ];
  }

  return [
    `CREATE TABLE IF NOT EXISTS app_schema_migrations (
      migration_id VARCHAR(128) PRIMARY KEY,
      applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS learning_profiles (
      account_id VARCHAR(64) PRIMARY KEY,
      revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
      practice_best INT UNSIGNED NOT NULL DEFAULT 0,
      practice_attempts BIGINT UNSIGNED NOT NULL DEFAULT 0,
      client_updated_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_learning_profiles_updated_at (updated_at),
      CONSTRAINT fk_learning_profiles_account FOREIGN KEY (account_id) REFERENCES admin_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS learning_lesson_progress (
      account_id VARCHAR(64) NOT NULL,
      lesson_id VARCHAR(128) NOT NULL,
      completed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (account_id, lesson_id),
      INDEX idx_learning_lessons_account_updated (account_id, updated_at),
      CONSTRAINT fk_learning_lessons_account FOREIGN KEY (account_id) REFERENCES admin_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS learning_progress_mutations (
      account_id VARCHAR(64) NOT NULL,
      mutation_id VARCHAR(80) NOT NULL,
      mutation_type VARCHAR(32) NOT NULL,
      score INT UNSIGNED NOT NULL,
      occurred_at DATETIME(3) NOT NULL,
      applied_revision BIGINT UNSIGNED NOT NULL,
      applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (account_id, mutation_id),
      INDEX idx_learning_mutations_account_applied (account_id, applied_at),
      CONSTRAINT fk_learning_mutations_account FOREIGN KEY (account_id) REFERENCES admin_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`,
    `INSERT IGNORE INTO app_schema_migrations (migration_id, applied_at)
     VALUES ('${LEARNING_PROGRESS_MIGRATION_ID}', UTC_TIMESTAMP(3))`,
  ];
}
