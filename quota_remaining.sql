-- Vérifie le quota restant d'un utilisateur par catégorie.
-- Usage par UUID:
--   SELECT * FROM get_user_quota_remaining('00000000-0000-0000-0000-000000000000');
--
-- Usage par email:
--   SELECT q.*
--   FROM users u
--   CROSS JOIN LATERAL get_user_quota_remaining(u.id) q
--   WHERE u.email = 'user@example.com';

CREATE OR REPLACE FUNCTION get_user_quota_remaining(p_user_id UUID)
RETURNS TABLE (
  tier TEXT,
  used_5h INT,
  quota_5h INT,
  remaining_5h INT,
  percent_available INT,
  window_reset_at TIMESTAMPTZ,
  used_week INT,
  week_cap INT,
  week_remaining INT
)
LANGUAGE sql
STABLE
AS $$
  WITH target_user AS (
    SELECT id, plan
    FROM users
    WHERE id = p_user_id
  ),
  plan_quotas(plan, tier, quota_5h) AS (
    VALUES
      ('LITE',  'EXPERT', 5),   ('LITE',  'PRICE', 10),  ('LITE',  'NORMAL', 20),  ('LITE',  'MINI', 60),   ('LITE',  'NANO', 200),
      ('PLUS',  'EXPERT', 15),  ('PLUS',  'PRICE', 30),  ('PLUS',  'NORMAL', 50),  ('PLUS',  'MINI', 150),  ('PLUS',  'NANO', 500),
      ('PRO',   'EXPERT', 40),  ('PRO',   'PRICE', 80),  ('PRO',   'NORMAL', 120), ('PRO',   'MINI', 400),  ('PRO',   'NANO', 1500),
      ('ULTRA', 'EXPERT', 200), ('ULTRA', 'PRICE', 400), ('ULTRA', 'NORMAL', 600), ('ULTRA', 'MINI', 2000), ('ULTRA', 'NANO', 5000)
  ),
  weekly_caps(plan, tier, week_cap) AS (
    VALUES
      ('LITE', 'EXPERT', 20),
      ('PLUS', 'EXPERT', 60),
      ('PRO', 'EXPERT', 200),
      ('ULTRA', 'EXPERT', 1000)
  ),
  tier_order(tier, sort_order) AS (
    VALUES
      ('EXPERT', 1),
      ('PRICE', 2),
      ('NORMAL', 3),
      ('MINI', 4),
      ('NANO', 5)
  ),
  active_windows AS (
    SELECT DISTINCT ON (uw.tier)
      uw.tier,
      uw.messages_count,
      uw.window_start
    FROM usage_windows uw
    WHERE uw.user_id = p_user_id
      AND uw.window_start > NOW() - INTERVAL '5 hours'
    ORDER BY uw.tier, uw.window_start DESC
  ),
  week_usage AS (
    SELECT wu.tier, wu.messages_count
    FROM weekly_usage wu
    WHERE wu.user_id = p_user_id
      AND wu.week_start = DATE_TRUNC('week', NOW())::DATE
  )
  SELECT
    pq.tier,
    COALESCE(aw.messages_count, 0)::INT AS used_5h,
    pq.quota_5h::INT AS quota_5h,
    GREATEST(pq.quota_5h - COALESCE(aw.messages_count, 0), 0)::INT AS remaining_5h,
    CASE
      WHEN pq.quota_5h <= 0 THEN 0
      ELSE ROUND((GREATEST(pq.quota_5h - COALESCE(aw.messages_count, 0), 0)::NUMERIC / pq.quota_5h) * 100)::INT
    END AS percent_available,
    CASE
      WHEN aw.window_start IS NULL THEN NULL
      ELSE aw.window_start + INTERVAL '5 hours'
    END AS window_reset_at,
    COALESCE(wu.messages_count, 0)::INT AS used_week,
    wc.week_cap::INT AS week_cap,
    CASE
      WHEN wc.week_cap IS NULL THEN NULL
      ELSE GREATEST(wc.week_cap - COALESCE(wu.messages_count, 0), 0)::INT
    END AS week_remaining
  FROM target_user tu
  JOIN plan_quotas pq ON pq.plan = tu.plan
  JOIN tier_order tor ON tor.tier = pq.tier
  LEFT JOIN active_windows aw ON aw.tier = pq.tier
  LEFT JOIN weekly_caps wc ON wc.plan = tu.plan AND wc.tier = pq.tier
  LEFT JOIN week_usage wu ON wu.tier = pq.tier
  ORDER BY tor.sort_order;
$$;
