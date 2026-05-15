-- ═══════════════════════════════════════════════════════════════════════════
-- DELT AI — Schéma PostgreSQL complet (Supabase) + conformité RGPD
-- Coller dans : Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- Extension UUID (déjà active sur Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── USERS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT UNIQUE NOT NULL,
  password        TEXT NOT NULL DEFAULT '',      -- vide pour comptes OAuth
  auth_provider   TEXT NOT NULL DEFAULT 'email', -- 'email' | 'google'
  plan            TEXT NOT NULL DEFAULT 'FREE',  -- FREE | BASIC | PLUS | PRO | ULTRA
  credits         NUMERIC(10,2) NOT NULL DEFAULT 0,
  api_credits     NUMERIC(10,2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'active',
  secret_key      TEXT,                          -- DEK utilisateur chiffrée par la Master Key backend
  sub_id          TEXT,                          -- PayPal subscription ID
  sub_start       TIMESTAMPTZ,
  sub_end         TIMESTAMPTZ,
  age_verified    BOOLEAN DEFAULT FALSE,
  -- RGPD
  deleted_at      TIMESTAMPTZ,                   -- soft delete (droit à l'effacement)
  anonymized_at   TIMESTAMPTZ,                   -- après anonymisation des données
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE deleted_at IS NULL;
ALTER TABLE users ALTER COLUMN plan SET DEFAULT 'FREE';
UPDATE users SET plan = 'FREE' WHERE plan = 'LITE';

-- ─── CONSENTEMENTS RGPD ─────────────────────────────────────────────────────
-- Trace chaque consentement donné par l'utilisateur (obligatoire RGPD art. 7)
CREATE TABLE IF NOT EXISTS gdpr_consents (
  id            SERIAL PRIMARY KEY,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  consent_type  TEXT NOT NULL,    -- 'terms', 'marketing', 'google_oauth_signup', 'age_18'
  granted       BOOLEAN DEFAULT TRUE,
  ip_hash       TEXT,             -- hash SHA-256 de l'IP (jamais l'IP brute)
  user_agent    TEXT,
  granted_at    TIMESTAMPTZ DEFAULT NOW(),
  revoked_at    TIMESTAMPTZ,
  UNIQUE (user_id, consent_type)
);

-- ─── DEMANDES D'EXERCICE DE DROITS RGPD ─────────────────────────────────────
-- Art. 15-22 RGPD : accès, rectification, effacement, portabilité, opposition
CREATE TABLE IF NOT EXISTS gdpr_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  email         TEXT NOT NULL,    -- conservé même si le compte est supprimé
  request_type  TEXT NOT NULL,    -- 'access' | 'delete' | 'rectify' | 'portability' | 'opposition'
  status        TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'done' | 'rejected'
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ
);

-- ─── QUOTAS 5H ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usage_windows (
  id              SERIAL PRIMARY KEY,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  tier            TEXT NOT NULL,
  window_start    TIMESTAMPTZ NOT NULL,
  messages_count  INT DEFAULT 0,
  tokens_in       BIGINT DEFAULT 0,
  tokens_out      BIGINT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_windows_user_tier ON usage_windows(user_id, tier);

-- ─── CAP HEBDOMADAIRE EXPERT ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weekly_usage (
  id              SERIAL PRIMARY KEY,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  tier            TEXT NOT NULL,
  week_start      DATE NOT NULL,
  messages_count  INT DEFAULT 0,
  UNIQUE(user_id, tier, week_start)
);

-- ─── CONVERSATIONS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT, -- chiffré applicatif côté backend (enc:v1)
  summary     TEXT, -- chiffré applicatif côté backend si utilisé
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id, updated_at DESC) WHERE user_id IS NOT NULL;

-- ─── MESSAGES ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id          SERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  conv_id     UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,           -- 'user' | 'assistant'
  content     TEXT NOT NULL,           -- chiffré applicatif côté backend (enc:v1)
  tier_used   TEXT,
  model_id    TEXT,
  tokens_in   INT,
  tokens_out  INT,
  cost_eur    NUMERIC(10,6),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conv_id, created_at);

-- ─── ÉVÉNEMENTS PAYPAL ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS paypal_events (
  id          TEXT PRIMARY KEY,        -- PayPal event ID (idempotence)
  event_type  TEXT,
  data        JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── LOGS D'ACTIVITÉ (audit trail RGPD) ─────────────────────────────────────
-- Conservé 12 mois maximum (purge automatique via pg_cron ou CRON externe)
CREATE TABLE IF NOT EXISTS audit_logs (
  id          SERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,       -- 'login', 'logout', 'plan_change', 'delete_request'
  ip_hash     TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id, created_at DESC);

-- ─── CLÉS API ───────────────────────────────────────────────────────────────
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

-- ─── PURGE AUTOMATIQUE LOGS >12 MOIS ────────────────────────────────────────
-- (À activer si pg_cron est disponible sur ton plan Supabase)
-- SELECT cron.schedule('purge-audit-logs', '0 3 * * *',
--   $$DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '12 months'$$);

-- ─── FONCTION : anonymiser un utilisateur (droit à l'effacement RGPD art.17) ─
CREATE OR REPLACE FUNCTION anonymize_user(p_user_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Remplace les données personnelles par des valeurs neutres
  UPDATE users SET
    email         = 'deleted_' || p_user_id || '@anon.delt',
    password      = '',
    auth_provider = 'deleted',
    status        = 'deleted',
    secret_key    = NULL,
    sub_id        = NULL,
    credits       = 0,
    api_credits   = 0,
    deleted_at    = NOW(),
    anonymized_at = NOW()
  WHERE id = p_user_id;

  -- Supprime le contenu des messages (mais conserve les métadonnées de facturation)
  UPDATE messages SET content = '[contenu supprimé]'
  WHERE user_id = p_user_id;

  -- Révoque tous les consentements
  UPDATE gdpr_consents SET revoked_at = NOW()
  WHERE user_id = p_user_id AND revoked_at IS NULL;

  -- Révoque toutes les clés API
  UPDATE api_keys SET revoked_at = NOW()
  WHERE user_id = p_user_id AND revoked_at IS NULL;

  -- Log l'action
  INSERT INTO audit_logs (user_id, action, metadata)
  VALUES (p_user_id, 'gdpr_anonymization', '{"source":"anonymize_user"}');
END;
$$;

-- ─── FONCTION : supprimer physiquement un utilisateur et ses données liées ──
-- Utilisée pour une suppression totale côté backend quand l'utilisateur supprime son compte.
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

-- ─── RLS (Row Level Security) ────────────────────────────────────────────────
-- Protège les données si tu passes par le client Supabase directement
-- (avec le JWT DELT + backend Express, le backend contrôle l'accès)

ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_consents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_windows   ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_usage    ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys        ENABLE ROW LEVEL SECURITY;

-- Service role (backend Express) → accès total
CREATE POLICY "service_full_access" ON users           FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_full_access" ON gdpr_consents   FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_full_access" ON gdpr_requests   FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_full_access" ON usage_windows   FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_full_access" ON weekly_usage    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_full_access" ON conversations   FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_full_access" ON messages        FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_full_access" ON audit_logs      FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_full_access" ON api_keys        FOR ALL USING (auth.role() = 'service_role');

-- Anon → aucun accès direct (tout passe par Express)
-- (pas de policy publique = refus par défaut)

-- ═══════════════════════════════════════════════════════════════════════════
-- NOTES RGPD
-- • Durée de conservation données utilisateur : jusqu'à suppression du compte
-- • Durée de conservation logs d'audit : 12 mois
-- • Durée de conservation données de facturation : 10 ans (obligation légale)
-- • DELETE /api/privacy/account et hard_delete_user() suppriment physiquement les données liées au compte
-- • anonymize_user() reste disponible seulement si tu dois conserver des métadonnées anonymisées
-- • Les IP ne sont jamais stockées brutes, uniquement en SHA-256
-- • PayPal events conservés pour obligation comptable (10 ans)
-- ═══════════════════════════════════════════════════════════════════════════
