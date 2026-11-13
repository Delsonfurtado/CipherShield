// ─── Auth Types ───────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  user_metadata: UserMetadata;
  app_metadata: AppMetadata;
}

export interface UserMetadata {
  full_name?: string;
  avatar_url?: string;
  two_factor_enabled?: boolean;
}

export interface AppMetadata {
  provider?: string;
  providers?: string[];
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  token_type: string;
  user: User;
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  auth_mode?: 'server' | 'local';
  encrypted_vault_key: string;
  vault_key_iv: string;
  argon2_salt: string;         // base64 encoded
  kdf_params: KDFParams;
  recovery_key_hash: string | null;
  encrypted_recovery_vault_key: string | null;
  recovery_vault_key_iv: string | null;
  two_factor_enabled: boolean;
  two_factor_secret: string | null;
  inactivity_timeout_minutes: number;
  clipboard_clear_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface KDFParams {
  m: number; // memory cost in KB (default 65536 = 64MB)
  t: number; // iterations (default 3)
  p: number; // parallelism (default 1)
  vault_key_iv?: string;
  encrypted_recovery_key?: string;
  recovery_iv?: string;
}

// ─── Auth Flow ────────────────────────────────────────────────────────────────

export interface LoginCredentials {
  email: string;
  masterPassword: string;
}

export interface RegisterCredentials {
  email: string;
  masterPassword: string;
  confirmPassword: string;
}

export interface RegisterResult {
  recoveryPhrase: string;
  user: User;
}

export interface AuthChallenge {
  argon2_salt: string;
  kdf_params: KDFParams;
}

export interface TwoFactorVerifyPayload {
  code: string;
  token: string;
}

// ─── Form Schemas (Zod-inferred) ──────────────────────────────────────────────

export interface LoginFormValues {
  email: string;
  masterPassword: string;
}

export interface RegisterFormValues {
  email: string;
  masterPassword: string;
  confirmPassword: string;
}

export interface ChangeMasterPasswordFormValues {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface AuthNotification {
  id: string;
  user_id: string;
  type: 'new_device_login' | 'password_changed' | 'breach_detected' | 'vault_exported';
  title: string;
  message: string;
  read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}
