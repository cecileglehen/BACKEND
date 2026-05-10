import pg from "pg";

const { Pool } = pg;

let pool = null;

export function getDb() {
  if (!pool) {
    const connectionString = normalizeConnectionString(process.env.DATABASE_URL);
    if (!connectionString) throw new Error("DATABASE_URL manquante dans .env");
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false }
    });
    pool.on("error", (e) => console.error("[pg] idle error", e.message));
  }
  return pool;
}

function normalizeConnectionString(connectionString) {
  if (!connectionString) return connectionString;

  try {
    const url = new URL(connectionString);
    url.searchParams.delete("sslmode");
    return url.toString();
  } catch {
    return connectionString;
  }
}

// Initialise le schéma au démarrage
export async function initSchema() {
  const db = getDb();
  await db.query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    CREATE TABLE IF NOT EXISTS users (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email           TEXT UNIQUE NOT NULL,
      password        TEXT NOT NULL DEFAULT '',
      auth_provider   TEXT NOT NULL DEFAULT 'email',
      plan            TEXT NOT NULL DEFAULT 'FREE',
      credits         NUMERIC(10,2) NOT NULL DEFAULT 0,
      status          TEXT NOT NULL DEFAULT 'active',
      secret_key      TEXT,
      sub_id          TEXT,
      sub_start       TIMESTAMPTZ,
      sub_end         TIMESTAMPTZ,
      age_verified    BOOLEAN DEFAULT FALSE,
      deleted_at      TIMESTAMPTZ,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'email';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS age_verified BOOLEAN DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS credits NUMERIC(10,2) NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS api_credits NUMERIC(10,2) NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS secret_key TEXT;
    ALTER TABLE users ALTER COLUMN plan SET DEFAULT 'FREE';
    UPDATE users SET plan = 'FREE' WHERE plan = 'LITE';

    CREATE TABLE IF NOT EXISTS gdpr_consents (
      id            SERIAL PRIMARY KEY,
      user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
      consent_type  TEXT NOT NULL,
      granted       BOOLEAN DEFAULT TRUE,
      ip_hash       TEXT,
      user_agent    TEXT,
      granted_at    TIMESTAMPTZ DEFAULT NOW(),
      revoked_at    TIMESTAMPTZ,
      UNIQUE (user_id, consent_type)
    );
    ALTER TABLE gdpr_consents ADD COLUMN IF NOT EXISTS user_agent TEXT;

    CREATE TABLE IF NOT EXISTS gdpr_requests (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
      email         TEXT NOT NULL,
      request_type  TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending',
      notes         TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      resolved_at   TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS usage_windows (
      id          SERIAL PRIMARY KEY,
      user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
      tier        TEXT NOT NULL,
      window_start TIMESTAMPTZ NOT NULL,
      messages_count INT DEFAULT 0,
      tokens_in   BIGINT DEFAULT 0,
      tokens_out  BIGINT DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_windows_user_tier ON usage_windows(user_id, tier);

    CREATE TABLE IF NOT EXISTS weekly_usage (
      id          SERIAL PRIMARY KEY,
      user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
      tier        TEXT NOT NULL,
      week_start  DATE NOT NULL,
      messages_count INT DEFAULT 0,
      UNIQUE(user_id, tier, week_start)
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
      -- title/summary sont chiffrés applicativement par le backend (enc:v1)
      title       TEXT,
      summary     TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id          SERIAL PRIMARY KEY,
      user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
      conv_id     UUID REFERENCES conversations(id) ON DELETE CASCADE,
      role        TEXT NOT NULL,
      -- content est chiffré applicativement par le backend (enc:v1)
      content     TEXT NOT NULL,
      tier_used   TEXT,
      model_id    TEXT,
      tokens_in   INT,
      tokens_out  INT,
      cost_eur    NUMERIC(10,6),
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS model_id TEXT;
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conv_id, created_at);

    CREATE TABLE IF NOT EXISTS paypal_events (
      id          TEXT PRIMARY KEY,
      event_type  TEXT,
      data        JSONB,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id          SERIAL PRIMARY KEY,
      user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
      action      TEXT NOT NULL,
      ip_hash     TEXT,
      metadata    JSONB,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS api_keys (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
      key_hash      TEXT NOT NULL UNIQUE,
      key_prefix    TEXT NOT NULL,
      name          TEXT,
      last_used_at  TIMESTAMPTZ,
      revoked_at    TIMESTAMPTZ,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash) WHERE revoked_at IS NULL;

    CREATE OR REPLACE FUNCTION anonymize_user(p_user_id UUID)
    RETURNS void LANGUAGE plpgsql AS $$
    BEGIN
      UPDATE users SET
        email = 'deleted_' || p_user_id || '@anon.delt',
        password = '',
        auth_provider = 'deleted',
        status = 'deleted',
        secret_key = NULL,
        sub_id = NULL,
        credits = 0,
        api_credits = 0,
        deleted_at = NOW(),
        anonymized_at = NOW()
      WHERE id = p_user_id;

      UPDATE messages SET content = '[contenu supprimé]'
      WHERE user_id = p_user_id;

      UPDATE gdpr_consents SET revoked_at = NOW()
      WHERE user_id = p_user_id AND revoked_at IS NULL;

      UPDATE api_keys SET revoked_at = NOW()
      WHERE user_id = p_user_id AND revoked_at IS NULL;
    END;
    $$;

    CREATE OR REPLACE FUNCTION hard_delete_user(p_user_id UUID)
    RETURNS void LANGUAGE plpgsql AS $$
    BEGIN
      DELETE FROM messages WHERE user_id = p_user_id;
      DELETE FROM conversations WHERE user_id = p_user_id;
      DELETE FROM api_keys WHERE user_id = p_user_id;
      DELETE FROM usage_windows WHERE user_id = p_user_id;
      DELETE FROM weekly_usage WHERE user_id = p_user_id;
      DELETE FROM gdpr_consents WHERE user_id = p_user_id;
      DELETE FROM audit_logs WHERE user_id = p_user_id;
      DELETE FROM gdpr_requests WHERE user_id = p_user_id;
      DELETE FROM users WHERE id = p_user_id;
    END;
    $$;
  `);
  console.log("✓ DB schema ready");
}
