-- =============================================================================
-- CipherShield — Zero-Knowledge Password Manager
-- Migration: 001_initial_schema.sql
-- Description: Initial database schema — tables, indexes, and triggers
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Utility: updated_at trigger function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
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
-- TABLE: profiles
-- One-to-one with auth.users. Stores per-user cryptographic material and prefs.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id                    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                 TEXT        NOT NULL,
  -- Argon2id key derivation parameters
  argon2_salt           TEXT        NOT NULL,                        -- base64-encoded, per-user random salt
  encrypted_vault_key   TEXT        NOT NULL,                        -- AES-256-GCM encrypted vault key, base64
  vault_key_iv          TEXT        NOT NULL,                        -- base64 IV used to encrypt vault key
  kdf_params            JSONB       NOT NULL DEFAULT '{"m":65536,"t":3,"p":1}'::jsonb,
  -- Asymmetric key material for secure sharing
  public_key            TEXT,                                        -- RSA-OAEP public key (PEM / JWK)
  encrypted_private_key TEXT,                                        -- Private key encrypted with Vault Key
  -- Two-factor authentication
  two_factor_enabled    BOOLEAN     NOT NULL DEFAULT FALSE,
  two_factor_secret     TEXT,                                        -- server-side encrypted TOTP secret
  backup_codes          TEXT[],                                      -- bcrypt-hashed backup codes
  -- Security analytics
  security_score        INTEGER     NOT NULL DEFAULT 0 CHECK (security_score BETWEEN 0 AND 100),
  -- UX preferences
  inactivity_timeout    INTEGER     NOT NULL DEFAULT 300  CHECK (inactivity_timeout >= 0),   -- seconds
  clipboard_timeout     INTEGER     NOT NULL DEFAULT 30   CHECK (clipboard_timeout  >= 0),   -- seconds
  theme                 TEXT        NOT NULL DEFAULT 'system' CHECK (theme IN ('light','dark','system')),
  language              TEXT        NOT NULL DEFAULT 'en',
  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TABLE: folders
-- Hierarchical folders (self-referencing) owned by a user.
-- Defined before vault_items because vault_items references it.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.folders (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  color       TEXT,
  icon        TEXT,
  parent_id   UUID        REFERENCES public.folders(id) ON DELETE SET NULL,  -- nullable for root-level folders
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_folders_user_id    ON public.folders (user_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id  ON public.folders (parent_id);

CREATE TRIGGER trg_folders_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TABLE: vault_items
-- Core table — each row is a client-side AES-256-GCM encrypted payload.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.vault_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type            TEXT        NOT NULL CHECK (type IN ('login','note','card','identity','api_key','wifi')),
  encrypted_data  TEXT        NOT NULL,  -- AES-256-GCM encrypted JSON blob, base64
  iv              TEXT        NOT NULL,  -- base64 IV
  folder_id       UUID        REFERENCES public.folders(id) ON DELETE SET NULL,
  is_favorite     BOOLEAN     NOT NULL DEFAULT FALSE,
  is_deleted      BOOLEAN     NOT NULL DEFAULT FALSE,
  deleted_at      TIMESTAMPTZ,
  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Ensure deleted_at is populated when item is soft-deleted
  CONSTRAINT chk_deleted_at CHECK (
    (is_deleted = FALSE AND deleted_at IS NULL) OR
    (is_deleted = TRUE  AND deleted_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_vault_items_user_id            ON public.vault_items (user_id);
CREATE INDEX IF NOT EXISTS idx_vault_items_user_not_deleted   ON public.vault_items (user_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_vault_items_folder             ON public.vault_items (folder_id) WHERE folder_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vault_items_deleted_at         ON public.vault_items (deleted_at) WHERE is_deleted = TRUE;
CREATE INDEX IF NOT EXISTS idx_vault_items_type               ON public.vault_items (user_id, type);

CREATE TRIGGER trg_vault_items_updated_at
  BEFORE UPDATE ON public.vault_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TABLE: item_history
-- Immutable audit trail of previous encrypted states for each vault item.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.item_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         UUID        NOT NULL REFERENCES public.vault_items(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_data  TEXT        NOT NULL,  -- snapshot of the encrypted payload at time of change
  iv              TEXT        NOT NULL,  -- base64 IV used for this snapshot
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_item_history_item_id  ON public.item_history (item_id);
CREATE INDEX IF NOT EXISTS idx_item_history_user_id  ON public.item_history (user_id);

-- =============================================================================
-- TABLE: tags
-- User-defined labels for organizing vault items.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.tags (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  color       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)  -- tag names must be unique per user
);

CREATE INDEX IF NOT EXISTS idx_tags_user_id ON public.tags (user_id);

-- =============================================================================
-- TABLE: item_tags
-- Many-to-many join between vault_items and tags.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.item_tags (
  item_id  UUID NOT NULL REFERENCES public.vault_items(id) ON DELETE CASCADE,
  tag_id   UUID NOT NULL REFERENCES public.tags(id)        ON DELETE CASCADE,
  PRIMARY KEY (item_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_item_tags_tag_id ON public.item_tags (tag_id);

-- =============================================================================
-- TABLE: sessions
-- Tracks active/historical device sessions per user.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name     TEXT,
  device_type     TEXT,        -- 'desktop' | 'mobile' | 'tablet' | 'unknown'
  browser         TEXT,
  os              TEXT,
  ip_address      INET,
  location        TEXT,
  last_active_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_current      BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id       ON public.sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last_active   ON public.sessions (user_id, last_active_at DESC);

-- =============================================================================
-- TABLE: audit_logs
-- Immutable security event log. INSERT via service role or triggers only.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action         TEXT        NOT NULL,  -- e.g. 'vault.unlock', 'item.view', 'login.success'
  resource_type  TEXT,                  -- e.g. 'vault_item', 'folder', 'session'
  resource_id    UUID,
  ip_address     INET,
  device         TEXT,
  location       TEXT,
  metadata       JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action     ON public.audit_logs (action);

-- =============================================================================
-- TABLE: share_links
-- Ephemeral encrypted share links with optional passphrase and expiry.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.share_links (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_data   TEXT        NOT NULL,  -- shared vault item data, encrypted
  iv               TEXT        NOT NULL,
  has_passphrase   BOOLEAN     NOT NULL DEFAULT FALSE,
  passphrase_hash  TEXT,                  -- bcrypt hash of the passphrase
  max_views        INTEGER     CHECK (max_views IS NULL OR max_views > 0),
  view_count       INTEGER     NOT NULL DEFAULT 0,
  expires_at       TIMESTAMPTZ,
  is_destroyed     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_share_links_user_id    ON public.share_links (user_id);
CREATE INDEX IF NOT EXISTS idx_share_links_expires_at ON public.share_links (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_share_links_active     ON public.share_links (is_destroyed, expires_at);

CREATE TRIGGER trg_share_links_updated_at
  BEFORE UPDATE ON public.share_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TABLE: emergency_contacts
-- Digital inheritance — allows a trusted contact to request vault access
-- after a configurable waiting period.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.emergency_contacts (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_email         TEXT        NOT NULL,
  contact_user_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  waiting_period_hours  INTEGER     NOT NULL DEFAULT 48 CHECK (waiting_period_hours >= 0),
  status                TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','active','requesting','approved','rejected')),
  request_initiated_at  TIMESTAMPTZ,
  approved_at           TIMESTAMPTZ,
  encrypted_vault_key   TEXT,        -- vault key re-encrypted for contact's RSA public key
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_id, contact_email)
);

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_owner_id         ON public.emergency_contacts (owner_id);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_contact_user_id  ON public.emergency_contacts (contact_user_id)
  WHERE contact_user_id IS NOT NULL;

CREATE TRIGGER trg_emergency_contacts_updated_at
  BEFORE UPDATE ON public.emergency_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TABLE: breach_cache
-- Server-side cache for HaveIBeenPwned breach data. No direct user access.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.breach_cache (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        NOT NULL,
  breaches    JSONB       NOT NULL,
  checked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_breach_cache_checked_at ON public.breach_cache (checked_at);

-- =============================================================================
-- TABLE: notifications
-- In-app notifications for security events, sharing, emergency access, etc.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL,   -- e.g. 'breach_alert', 'emergency_request', 'share_received'
  title       TEXT        NOT NULL,
  body        TEXT,
  metadata    JSONB,
  is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id  ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread   ON public.notifications (user_id, is_read) WHERE is_read = FALSE;

-- =============================================================================
-- TABLE: security_score_history
-- Historical snapshots of a user's vault security score for trend analysis.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.security_score_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score           INTEGER     NOT NULL CHECK (score BETWEEN 0 AND 100),
  weak_count      INTEGER     NOT NULL DEFAULT 0,
  reused_count    INTEGER     NOT NULL DEFAULT 0,
  breached_count  INTEGER     NOT NULL DEFAULT 0,
  old_count       INTEGER     NOT NULL DEFAULT 0,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_score_history_user_id     ON public.security_score_history (user_id);
CREATE INDEX IF NOT EXISTS idx_security_score_history_recorded_at ON public.security_score_history (user_id, recorded_at DESC);
