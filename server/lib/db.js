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
    ALTER TABLE users ADD COLUMN IF NOT EXISTS transcription_seconds INT NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS transcription_month TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS free_nano_tokens INT NOT NULL DEFAULT 10000;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS free_nano_month TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS free_model_tokens JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS model_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded_models BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS memory_profile JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS quota_window_start TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS quota_window_used NUMERIC(12,2) NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_premium_start TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_premium_used NUMERIC(12,2) NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_premium_used NUMERIC(12,2) NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_premium_month TEXT;

    CREATE TABLE IF NOT EXISTS projects (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      description   TEXT,
      color         TEXT DEFAULT '#6366f1',
      icon          TEXT DEFAULT '📁',
      system_prompt TEXT,
      default_model TEXT,
      memory        JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id, updated_at DESC);
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_id);

    CREATE TABLE IF NOT EXISTS agents (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      description   TEXT,
      color         TEXT DEFAULT '#6366f1',
      icon          TEXT DEFAULT '🤖',
      instructions  TEXT,
      default_model TEXT,
      tools         JSONB NOT NULL DEFAULT '[]'::jsonb,
      capabilities  JSONB NOT NULL DEFAULT '{}'::jsonb,
      knowledge     JSONB NOT NULL DEFAULT '{}'::jsonb,
      starters      JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_agents_user ON agents(user_id, updated_at DESC);

    -- Missions d'agent en arrière-plan (boucle Plan → Act → Observe → Verify)
    CREATE TABLE IF NOT EXISTS agent_runs (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      agent_id      UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      goal          TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'running',
      steps         JSONB NOT NULL DEFAULT '[]'::jsonb,
      result        TEXT,
      error         TEXT,
      credit_cost   NUMERIC DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_agent_runs_user ON agent_runs(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_agent_runs_agent ON agent_runs(agent_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS usage_log (
      id          BIGSERIAL PRIMARY KEY,
      user_id     UUID NOT NULL,
      model_id    TEXT NOT NULL,
      tier        TEXT,
      tokens_in   INT  NOT NULL DEFAULT 0,
      tokens_out  INT  NOT NULL DEFAULT 0,
      cost_cr     NUMERIC(10,4) NOT NULL DEFAULT 0,
      source      TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_usage_log_user_date ON usage_log(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_usage_log_user_model ON usage_log(user_id, model_id);

    -- Launch (Bolt-like) : projets, fichiers, déploiements — persistés en DB
    -- (le filesystem Render est éphémère).
    CREATE TABLE IF NOT EXISTS launch_projects (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT,
      summary     TEXT,
      prompt      TEXT,
      mode        TEXT NOT NULL DEFAULT 'react',
      run         JSONB,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_launch_projects_user ON launch_projects(user_id, updated_at DESC);
    -- Slug lisible pour l'URL du projet : launch.<domaine>/p/<slug>
    ALTER TABLE launch_projects ADD COLUMN IF NOT EXISTS slug TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_launch_projects_slug ON launch_projects(slug);
    -- Conversation IA (Code + Plan) persistée par projet
    ALTER TABLE launch_projects ADD COLUMN IF NOT EXISTS chat JSONB;

    CREATE TABLE IF NOT EXISTS launch_files (
      project_id  UUID NOT NULL REFERENCES launch_projects(id) ON DELETE CASCADE,
      path        TEXT NOT NULL,
      content     TEXT NOT NULL DEFAULT '',
      bytes       INT  NOT NULL DEFAULT 0,
      PRIMARY KEY (project_id, path)
    );
    -- encoding : 'utf8' (texte éditable par l'IA) ou 'base64' (binaire : images, logo)
    ALTER TABLE launch_files ADD COLUMN IF NOT EXISTS encoding TEXT NOT NULL DEFAULT 'utf8';
    ALTER TABLE launch_files ADD COLUMN IF NOT EXISTS content_type TEXT;

    CREATE TABLE IF NOT EXISTS launch_deploys (
      slug        TEXT PRIMARY KEY,
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS launch_deploy_files (
      slug         TEXT NOT NULL REFERENCES launch_deploys(slug) ON DELETE CASCADE,
      path         TEXT NOT NULL,
      content      TEXT NOT NULL DEFAULT '',
      content_type TEXT,
      PRIMARY KEY (slug, path)
    );
    ALTER TABLE launch_deploy_files ADD COLUMN IF NOT EXISTS encoding TEXT NOT NULL DEFAULT 'utf8';
    -- 1 seul déploiement par projet (anti-flood) : project_id unique.
    ALTER TABLE launch_deploys ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES launch_projects(id) ON DELETE CASCADE;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_launch_deploys_project ON launch_deploys(project_id);

    -- Utilisateurs DES apps générées (auth managée, scopée par projet).
    -- Distincts des utilisateurs DELT (table users).
    CREATE TABLE IF NOT EXISTS launch_app_users (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id  UUID NOT NULL REFERENCES launch_projects(id) ON DELETE CASCADE,
      email       TEXT NOT NULL,
      password    TEXT,
      name        TEXT,
      provider    TEXT NOT NULL DEFAULT 'email',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (project_id, email)
    );

    -- Données des apps générées (base "no-code" auto, scopée projet + collection).
    CREATE TABLE IF NOT EXISTS launch_app_data (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id  UUID NOT NULL REFERENCES launch_projects(id) ON DELETE CASCADE,
      collection  TEXT NOT NULL,
      owner_id    UUID,
      data        JSONB NOT NULL DEFAULT '{}',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_launch_app_data
      ON launch_app_data(project_id, collection, created_at DESC);

    -- Stripe Connect : 1 compte connecté PAR créateur (réutilisé sur tous ses projets).
    ALTER TABLE users ADD COLUMN IF NOT EXISTS launch_stripe_account_id TEXT;
    -- (legacy, conservé) ancien compte par projet
    ALTER TABLE launch_projects ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
    -- Cible Notion (page/DB) du créateur pour journaliser les commandes
    ALTER TABLE launch_projects ADD COLUMN IF NOT EXISTS notion_target TEXT;

    CREATE TABLE IF NOT EXISTS launch_payments (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id    UUID NOT NULL REFERENCES launch_projects(id) ON DELETE CASCADE,
      app_user_id   UUID,
      session_id    TEXT UNIQUE,
      amount        INT NOT NULL DEFAULT 0,
      currency      TEXT NOT NULL DEFAULT 'eur',
      fee           INT NOT NULL DEFAULT 0,
      label         TEXT,
      status        TEXT NOT NULL DEFAULT 'pending',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_launch_payments_project
      ON launch_payments(project_id, created_at DESC);
    ALTER TABLE launch_payments ADD COLUMN IF NOT EXISTS customer JSONB;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS secret_key TEXT;
    ALTER TABLE users ALTER COLUMN plan SET DEFAULT 'FREE';
    UPDATE users SET plan = 'FREE' WHERE plan = 'LITE';

    CREATE TABLE IF NOT EXISTS deep_search_reports (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
      prompt      TEXT NOT NULL,
      answer      TEXT,
      sources     JSONB,
      steps       JSONB,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_deep_search_reports_user_date
      ON deep_search_reports(user_id, created_at DESC);

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
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS meta JSONB;
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conv_id, created_at);

    CREATE TABLE IF NOT EXISTS paypal_events (
      id          TEXT PRIMARY KEY,
      event_type  TEXT,
      data        JSONB,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS credit_orders (
      id          TEXT PRIMARY KEY,
      user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
      pack_id     TEXT,
      credits     INT NOT NULL DEFAULT 0,
      amount_eur  NUMERIC(10,2) NOT NULL DEFAULT 0,
      status      TEXT NOT NULL DEFAULT 'pending',
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_credit_orders_user ON credit_orders(user_id, created_at DESC);

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

    -- ─── Intégrations Composio (Gmail, Drive, Notion, …) ─────────────────
    CREATE TABLE IF NOT EXISTS user_integrations (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
      app_name       TEXT NOT NULL,        -- "gmail", "googledrive", "slack"…
      connection_id  TEXT NOT NULL,        -- Composio connectionId
      entity_id      TEXT NOT NULL,        -- Composio entityId (= user_id)
      status         TEXT NOT NULL DEFAULT 'active',  -- active | revoked
      connected_at   TIMESTAMPTZ DEFAULT NOW(),
      revoked_at     TIMESTAMPTZ,
      UNIQUE (user_id, app_name)
    );
    CREATE INDEX IF NOT EXISTS idx_user_integrations ON user_integrations(user_id) WHERE status = 'active';

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

  // ─── Sécurité RLS (RGPD) ──────────────────────────────────────────────────
  // Active Row Level Security sur TOUTES les tables publiques + révoque les
  // accès des rôles API publics de Supabase (anon/authenticated). Le backend
  // se connecte en rôle propriétaire qui *bypass* RLS → aucun impact sur l'app.
  // Sans ça, la clé anon (publique, embarquée dans le bundle front) permet de
  // lire/écrire les tables via l'API REST auto de Supabase. Idempotent.
  await db.query(`
    DO $$
    DECLARE t text;
    BEGIN
      FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
        EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated;', t);
      END LOOP;
    END $$;
  `);

  console.log("✓ DB schema ready");
}
