-- =============================================================================
-- CipherShield — Zero-Knowledge Password Manager
-- Migration: 003_functions.sql
-- Description: Stored functions, triggers, and scheduled job helpers
-- =============================================================================

-- =============================================================================
-- FUNCTION: handle_new_user()
-- Trigger function fired AFTER INSERT on auth.users.
-- Creates a stub profile row; the client fills cryptographic fields on first unlock.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    -- Placeholder values — the client MUST replace these with real cryptographic
    -- material derived from the master password before the vault can be used.
    argon2_salt,
    encrypted_vault_key,
    vault_key_iv,
    kdf_params
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    -- Placeholder salts/keys; replaced during first-login onboarding flow
    encode(gen_random_bytes(32), 'base64'),   -- argon2_salt: 32 random bytes
    '',                                        -- encrypted_vault_key: set by client
    '',                                        -- vault_key_iv: set by client
    '{"m":65536,"t":3,"p":1}'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;              -- idempotent — safe to replay

  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users (runs with SECURITY DEFINER so it can write profiles)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- FUNCTION: update_updated_at_column()
-- Generic trigger function to auto-refresh updated_at timestamps.
-- (Defined in 001 but re-created here idempotently for standalone deployments.)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- FUNCTION: cleanup_deleted_items()
-- Permanently purges soft-deleted vault_items older than 30 days.
-- Intended to be called by a Supabase Edge Function cron job or pg_cron.
--
-- Usage (pg_cron):
--   SELECT cron.schedule('cleanup-trash', '0 3 * * *', 'SELECT public.cleanup_deleted_items()');
-- =============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_deleted_items()
RETURNS TABLE (
  purged_count  BIGINT,
  purged_before TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff       TIMESTAMPTZ := NOW() - INTERVAL '30 days';
  v_purged_count BIGINT;
BEGIN
  -- Cascade deletes item_history and item_tags via FK ON DELETE CASCADE
  DELETE FROM public.vault_items
  WHERE is_deleted  = TRUE
    AND deleted_at  < v_cutoff;

  GET DIAGNOSTICS v_purged_count = ROW_COUNT;

  -- Audit the cleanup event using service role context
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    metadata
  )
  SELECT
    -- System-level log entry; use a sentinel nil UUID to represent the system actor.
    '00000000-0000-0000-0000-000000000000'::uuid,
    'system.cleanup_deleted_items',
    'vault_items',
    jsonb_build_object(
      'purged_count',  v_purged_count,
      'cutoff_date',   v_cutoff,
      'executed_at',   NOW()
    )
  WHERE v_purged_count > 0;  -- only log when something was actually purged

  RETURN QUERY SELECT v_purged_count, v_cutoff;
END;
$$;

-- =============================================================================
-- FUNCTION: get_user_security_summary(p_user_id uuid)
-- Returns a lightweight security dashboard summary for the authenticated user.
-- Called from the Next.js API layer; enforces that callers can only query themselves.
--
-- Returns:
--   total_items       — all non-deleted vault items
--   favorite_items    — items marked as favorite
--   deleted_items     — items in the trash
--   folder_count      — total folders
--   tag_count         — total tags
--   session_count     — active sessions
--   unread_notifs     — unread notifications
--   current_score     — latest security score (0-100)
--   last_score_at     — timestamp of latest score snapshot
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_user_security_summary(p_user_id UUID)
RETURNS TABLE (
  total_items      BIGINT,
  favorite_items   BIGINT,
  deleted_items    BIGINT,
  folder_count     BIGINT,
  tag_count        BIGINT,
  session_count    BIGINT,
  unread_notifs    BIGINT,
  current_score    INTEGER,
  last_score_at    TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Enforce that authenticated users can only query their own summary
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Access denied: cannot query another user''s security summary'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  WITH
    items AS (
      SELECT
        COUNT(*)                                      AS total,
        COUNT(*) FILTER (WHERE is_favorite = TRUE
                           AND is_deleted  = FALSE)  AS favorites,
        COUNT(*) FILTER (WHERE is_deleted  = TRUE)   AS deleted
      FROM public.vault_items
      WHERE user_id = p_user_id
    ),
    score_snap AS (
      SELECT score, recorded_at
      FROM   public.security_score_history
      WHERE  user_id = p_user_id
      ORDER  BY recorded_at DESC
      LIMIT  1
    )
  SELECT
    items.total                                                       AS total_items,
    items.favorites                                                   AS favorite_items,
    items.deleted                                                     AS deleted_items,
    (SELECT COUNT(*) FROM public.folders      WHERE user_id = p_user_id) AS folder_count,
    (SELECT COUNT(*) FROM public.tags         WHERE user_id = p_user_id) AS tag_count,
    (SELECT COUNT(*) FROM public.sessions     WHERE user_id = p_user_id) AS session_count,
    (SELECT COUNT(*) FROM public.notifications
       WHERE user_id = p_user_id AND is_read = FALSE)                 AS unread_notifs,
    COALESCE((SELECT score       FROM score_snap), 0)                 AS current_score,
    (SELECT recorded_at FROM score_snap)                              AS last_score_at
  FROM items;
END;
$$;

-- =============================================================================
-- FUNCTION: record_security_score(p_user_id uuid, p_score int, ...)
-- Convenience function called by the security-analysis Edge Function to persist
-- a new score snapshot and update the denormalised column on profiles.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.record_security_score(
  p_user_id       UUID,
  p_score         INTEGER,
  p_weak_count    INTEGER DEFAULT 0,
  p_reused_count  INTEGER DEFAULT 0,
  p_breached_count INTEGER DEFAULT 0,
  p_old_count     INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate range
  IF p_score < 0 OR p_score > 100 THEN
    RAISE EXCEPTION 'Security score must be between 0 and 100, got %', p_score
      USING ERRCODE = 'check_violation';
  END IF;

  -- Append snapshot
  INSERT INTO public.security_score_history (
    user_id, score, weak_count, reused_count, breached_count, old_count
  ) VALUES (
    p_user_id, p_score, p_weak_count, p_reused_count, p_breached_count, p_old_count
  );

  -- Keep the denormalised column on profiles in sync for fast dashboard reads
  UPDATE public.profiles
  SET    security_score = p_score
  WHERE  id             = p_user_id;
END;
$$;

-- =============================================================================
-- FUNCTION: increment_share_link_view(p_link_id uuid)
-- Atomically increments view_count and optionally marks the link as destroyed
-- when max_views is reached. Called by the public share-link API endpoint.
-- Returns FALSE if the link is no longer accessible.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.increment_share_link_view(p_link_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link  public.share_links%ROWTYPE;
BEGIN
  -- Lock the row for update
  SELECT * INTO v_link
  FROM   public.share_links
  WHERE  id = p_link_id
  FOR    UPDATE;

  -- Link not found
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Reject if already destroyed or expired
  IF v_link.is_destroyed = TRUE
  OR (v_link.expires_at IS NOT NULL AND v_link.expires_at <= NOW())
  OR (v_link.max_views  IS NOT NULL AND v_link.view_count >= v_link.max_views) THEN
    RETURN FALSE;
  END IF;

  -- Increment view count and auto-destroy if max_views reached
  UPDATE public.share_links
  SET
    view_count   = view_count + 1,
    is_destroyed = CASE
                     WHEN max_views IS NOT NULL AND (view_count + 1) >= max_views THEN TRUE
                     ELSE FALSE
                   END
  WHERE id = p_link_id;

  RETURN TRUE;
END;
$$;

-- =============================================================================
-- GRANT execute permissions to the authenticated role for user-facing functions
-- (service-role functions remain callable only by the backend)
-- =============================================================================
GRANT EXECUTE ON FUNCTION public.get_user_security_summary(UUID)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_share_link_view(UUID)      TO anon, authenticated;
-- record_security_score and cleanup_deleted_items are service-role only (no grant)
