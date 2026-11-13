-- =============================================================================
-- CipherShield — Zero-Knowledge Password Manager
-- Migration: 002_rls_policies.sql
-- Description: Row Level Security — enable RLS and define access policies
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: check if the current role is the Supabase service role
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT current_setting('role', TRUE) = 'service_role'
     OR  current_setting('request.jwt.claims', TRUE)::jsonb->>'role' = 'service_role';
$$;

-- =============================================================================
-- profiles
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users may read their own profile
CREATE POLICY "profiles: select own"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users may update their own profile (cryptographic fields updated via secure API calls)
CREATE POLICY "profiles: update own"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- INSERT is handled exclusively by the handle_new_user() trigger (service role)
CREATE POLICY "profiles: insert service role"
  ON public.profiles
  FOR INSERT
  WITH CHECK (public.is_service_role());

-- =============================================================================
-- folders
-- =============================================================================
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "folders: select own"
  ON public.folders
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "folders: insert own"
  ON public.folders
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "folders: update own"
  ON public.folders
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "folders: delete own"
  ON public.folders
  FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- vault_items
-- =============================================================================
ALTER TABLE public.vault_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vault_items: select own"
  ON public.vault_items
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "vault_items: insert own"
  ON public.vault_items
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "vault_items: update own"
  ON public.vault_items
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Hard delete is allowed; soft-delete is handled by UPDATE (is_deleted flag)
CREATE POLICY "vault_items: delete own"
  ON public.vault_items
  FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- item_history  (immutable — no DELETE for users)
-- =============================================================================
ALTER TABLE public.item_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "item_history: select own"
  ON public.item_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users may append history snapshots (triggered by application logic)
CREATE POLICY "item_history: insert own"
  ON public.item_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE or DELETE policies — history rows are immutable by design

-- =============================================================================
-- tags
-- =============================================================================
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags: select own"
  ON public.tags
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "tags: insert own"
  ON public.tags
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tags: update own"
  ON public.tags
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tags: delete own"
  ON public.tags
  FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- item_tags
-- Users may manage tag assignments on items they own.
-- We join to vault_items to verify item ownership.
-- =============================================================================
ALTER TABLE public.item_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "item_tags: select own"
  ON public.item_tags
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.vault_items vi
      WHERE vi.id = item_id AND vi.user_id = auth.uid()
    )
  );

CREATE POLICY "item_tags: insert own"
  ON public.item_tags
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vault_items vi
      WHERE vi.id = item_id AND vi.user_id = auth.uid()
    )
  );

CREATE POLICY "item_tags: delete own"
  ON public.item_tags
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.vault_items vi
      WHERE vi.id = item_id AND vi.user_id = auth.uid()
    )
  );

-- =============================================================================
-- sessions
-- =============================================================================
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions: select own"
  ON public.sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Sessions are created by server-side auth hooks (service role)
CREATE POLICY "sessions: insert service role"
  ON public.sessions
  FOR INSERT
  WITH CHECK (public.is_service_role());

-- Users may revoke (delete) their own sessions
CREATE POLICY "sessions: delete own"
  ON public.sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Users may update session metadata (e.g. last_active_at via API)
CREATE POLICY "sessions: update own"
  ON public.sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- audit_logs  (append-only for users; service role for inserts)
-- =============================================================================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Users may read their own audit trail
CREATE POLICY "audit_logs: select own"
  ON public.audit_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role (backend / triggers) may write audit logs
CREATE POLICY "audit_logs: insert service role"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (public.is_service_role());

-- No UPDATE or DELETE — audit logs must be tamper-proof

-- =============================================================================
-- share_links
-- - Owner: full CRUD
-- - Public (unauthenticated or other users): SELECT only on active, non-destroyed,
--   non-expired links (for recipients accessing a shared link by ID)
-- =============================================================================
ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;

-- Owner: full access
CREATE POLICY "share_links: owner select"
  ON public.share_links
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "share_links: owner insert"
  ON public.share_links
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "share_links: owner update"
  ON public.share_links
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "share_links: owner delete"
  ON public.share_links
  FOR DELETE
  USING (auth.uid() = user_id);

-- Public recipients: may fetch a link only if it is active and not expired
-- (The application verifies the passphrase before revealing payload)
CREATE POLICY "share_links: public read active"
  ON public.share_links
  FOR SELECT
  USING (
    is_destroyed = FALSE
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_views IS NULL OR view_count < max_views)
  );

-- =============================================================================
-- emergency_contacts
-- - Owner: full CRUD on rows where owner_id = auth.uid()
-- - Contact: SELECT rows where contact_user_id = auth.uid() (to see pending requests)
-- =============================================================================
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "emergency_contacts: owner select"
  ON public.emergency_contacts
  FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "emergency_contacts: owner insert"
  ON public.emergency_contacts
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "emergency_contacts: owner update"
  ON public.emergency_contacts
  FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "emergency_contacts: owner delete"
  ON public.emergency_contacts
  FOR DELETE
  USING (auth.uid() = owner_id);

-- Trusted contact may view the emergency access row assigned to them
CREATE POLICY "emergency_contacts: contact select"
  ON public.emergency_contacts
  FOR SELECT
  USING (contact_user_id = auth.uid());

-- Trusted contact may update status (e.g., approve/reject request)
CREATE POLICY "emergency_contacts: contact update status"
  ON public.emergency_contacts
  FOR UPDATE
  USING (contact_user_id = auth.uid())
  WITH CHECK (contact_user_id = auth.uid());

-- =============================================================================
-- breach_cache  (service role only — no direct user access)
-- =============================================================================
ALTER TABLE public.breach_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "breach_cache: service role only"
  ON public.breach_cache
  FOR ALL
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

-- =============================================================================
-- notifications
-- =============================================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications: select own"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users may mark notifications as read (UPDATE is_read only)
CREATE POLICY "notifications: update own"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- INSERT via service role / triggers
CREATE POLICY "notifications: insert service role"
  ON public.notifications
  FOR INSERT
  WITH CHECK (public.is_service_role());

-- Users may dismiss (delete) their own notifications
CREATE POLICY "notifications: delete own"
  ON public.notifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- security_score_history
-- =============================================================================
ALTER TABLE public.security_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "security_score_history: select own"
  ON public.security_score_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "security_score_history: insert own"
  ON public.security_score_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE or DELETE — history is append-only
