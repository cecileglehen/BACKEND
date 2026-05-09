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
    CREATE TABLE IF NOT EXISTS users (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email           TEXT UNIQUE NOT NULL,
      password        TEXT NOT NULL DEFAULT '',
      auth_provider   TEXT NOT NULL DEFAULT 'email',
      plan            TEXT NOT NULL DEFAULT 'FREE',
      credits         NUMERIC(10,2) NOT NULL DEFAULT 0,
      status          TEXT NOT NULL DEFAULT 'active',
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
    ALTER TABLE users ADD COLUMN IF NOT EXISTS credits NUMERIC(10,2) NOT NULL DEFAULT 0;

    CREATE TABLE IF NOT EXISTS gdpr_consents (
      id            SERIAL PRIMARY KEY,
      user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
      consent_type  TEXT NOT NULL,
      granted       BOOLEAN DEFAULT TRUE,
      ip_hash       TEXT,
      granted_at    TIMESTAMPTZ DEFAULT NOW(),
      revoked_at    TIMESTAMPTZ,
      UNIQUE (user_id, consent_type)
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
      content     TEXT NOT NULL,
      tier_used   TEXT,
      tokens_in   INT,
      tokens_out  INT,
      cost_eur    NUMERIC(10,6),
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conv_id, created_at);

    CREATE TABLE IF NOT EXISTS paypal_events (
      id          TEXT PRIMARY KEY,
      event_type  TEXT,
      data        JSONB,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log("✓ DB schema ready");
}
