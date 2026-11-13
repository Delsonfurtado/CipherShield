// ─── API Types ────────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data: T;
  error: null;
}

export interface ApiError {
  data: null;
  error: {
    message: string;
    code: string;
    status: number;
    details?: Record<string, unknown>;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── Breach API ───────────────────────────────────────────────────────────────

export interface BreachCheckResult {
  password: string;
  compromised: boolean;
  count: number; // times seen in breaches
}

export interface AccountBreachResult {
  email: string;
  breaches: BreachEntry[];
}

export interface BreachEntry {
  Name: string;
  Title: string;
  Domain: string;
  BreachDate: string;
  AddedDate: string;
  DataClasses: string[];
  Description: string;
  LogoPath: string;
  IsVerified: boolean;
  IsFabricated: boolean;
  IsSensitive: boolean;
  IsSpamList: boolean;
  IsMalware: boolean;
}

// ─── Notifications API ────────────────────────────────────────────────────────

export interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  metadata: Record<string, unknown>;
}

// ─── Share API ────────────────────────────────────────────────────────────────

export interface CreateShareLinkResponse {
  share_id: string;
  link: string;
  expires_at: string | null;
}

export interface ResolveShareResponse {
  encrypted_data: string;
  iv: string;
  link_key: string | null; // for password-protected links
  item_type: string;
  item_name: string;
}

// ─── Vault API ────────────────────────────────────────────────────────────────

export interface CreateVaultItemPayload {
  type: string;
  name: string;
  encrypted_data: string;
  iv: string;
  folder_id?: string | null;
  tags?: string[];
  is_favorite?: boolean;
  password_strength?: number;
}

export interface UpdateVaultItemPayload extends Partial<CreateVaultItemPayload> {
  id: string;
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

export interface GetAuthChallengePayload {
  email: string;
}

export interface GetAuthChallengeResponse {
  argon2_salt: string;
  kdf_params: {
    m: number;
    t: number;
    p: number;
  };
}

export interface RegisterPayload {
  email: string;
  auth_key_hash: string;      // base64(authKey) used as password
  argon2_salt: string;         // base64
  kdf_params: {
    m: number;
    t: number;
    p: number;
  };
  encrypted_vault_key: string; // base64
  vault_key_iv: string;        // base64
  encrypted_recovery_vault_key: string;
  recovery_vault_key_iv: string;
  recovery_key_hash: string;
}

export interface UpdateProfilePayload {
  inactivity_timeout_minutes?: number;
  clipboard_clear_seconds?: number;
  two_factor_enabled?: boolean;
}
