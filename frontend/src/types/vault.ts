// ─── Vault Item Types ─────────────────────────────────────────────────────────

export type ItemType = 'login' | 'note' | 'card' | 'identity' | 'api_key' | 'wifi' | 'secure_note' | 'credit_card' | 'ssh_key';
export type VaultItemType = ItemType;

export type PasswordStrengthScore = 0 | 1 | 2 | 3 | 4;

// ─── Custom Fields ────────────────────────────────────────────────────────────

export interface CustomField {
  id: string;
  label: string;
  value: string;
  type: 'text' | 'hidden' | 'boolean';
}

// ─── Item Data Variants ───────────────────────────────────────────────────────

export interface LoginItemData {
  title?: string;
  username: string;
  password: string;
  uri?: string;
  urls?: string[];
  totp?: string;
  notes?: string;
  customFields?: CustomField[];
}

export interface SecureNoteData {
  title?: string;
  content: string;
  notes?: string;
  customFields?: CustomField[];
}

export interface CreditCardData {
  title?: string;
  cardholderName: string;
  number: string;
  expMonth: string;
  expYear: string;
  cvv: string;
  brand?: string;
  notes?: string;
  customFields?: CustomField[];
}

export interface IdentityData {
  title?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  notes?: string;
  customFields?: CustomField[];
}

export interface ApiKeyData {
  title?: string;
  key: string;
  service?: string;
  secret?: string;
  notes?: string;
  customFields?: CustomField[];
}

export interface WiFiData {
  title?: string;
  ssid: string;
  password: string;
  securityType?: string;
  notes?: string;
  customFields?: CustomField[];
}

export interface SSHKeyData {
  title?: string;
  privateKey: string;
  publicKey?: string;
  passphrase?: string;
  keyType?: 'RSA' | 'ED25519' | 'ECDSA';
  notes?: string;
  customFields?: CustomField[];
}

export type VaultItemData =
  | LoginItemData
  | SecureNoteData
  | CreditCardData
  | IdentityData
  | ApiKeyData
  | WiFiData
  | SSHKeyData
  | Record<string, unknown>;

// ─── Encrypted (Server) Item ──────────────────────────────────────────────────

export interface EncryptedVaultItem {
  id: string;
  user_id: string;
  vault_id?: string;
  type: ItemType;
  name?: string;
  encrypted_data: string; // base64 AES-GCM ciphertext
  iv: string;             // base64 IV
  folder_id: string | null;
  tags?: string[];
  is_favorite: boolean;
  is_deleted: boolean;
  deleted_at?: string | null;
  password_strength?: PasswordStrengthScore;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export type VaultItem = EncryptedVaultItem;

// ─── Decrypted Item ────────────────────────────────────────────────────────────

export interface DecryptedVaultItem extends EncryptedVaultItem {
  decryptedData: VaultItemData;
  data?: VaultItemData;
  isWeak?: boolean;
  isReused?: boolean;
  isOld?: boolean;
  isBreached?: boolean;
}

// ─── New Item Input ────────────────────────────────────────────────────────────

export interface NewVaultItem {
  type: ItemType;
  name?: string;
  data: VaultItemData;
  folder_id?: string | null;
  tags?: string[];
  is_favorite?: boolean;
}

// ─── Folder ───────────────────────────────────────────────────────────────────

export interface Folder {
  id: string;
  user_id?: string;
  name: string;
  parent_id?: string | null;
  color?: string;
  icon?: string;
  item_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface NewFolder {
  name: string;
  parent_id?: string | null;
  color?: string;
  icon?: string;
}

// ─── Tag ─────────────────────────────────────────────────────────────────────

export interface Tag {
  id: string;
  user_id?: string;
  name: string;
  color?: string;
  created_at?: string;
}

// ─── Vault Key Metadata ───────────────────────────────────────────────────────

export interface VaultKeyMetadata {
  encrypted_vault_key: string; // base64
  iv: string;                  // base64
}

// ─── Share ────────────────────────────────────────────────────────────────────

export interface SharedItem {
  id: string;
  item_id: string;
  shared_by: string;
  shared_key: string;
  encrypted_data: string;
  iv: string;
  expires_at: string | null;
  view_count: number;
  max_views: number | null;
  require_password: boolean;
  created_at: string;
}

export interface ShareLinkPayload {
  item_id: string;
  expires_hours?: number;
  max_views?: number;
  require_password?: boolean;
  link_password?: string;
}

// ─── Password History ─────────────────────────────────────────────────────────

export interface PasswordHistoryEntry {
  id: string;
  item_id: string;
  encrypted_password: string;
  iv: string;
  created_at: string;
}

// ─── Vault Sort / Filter ──────────────────────────────────────────────────────

export type VaultSortBy = 'name' | 'created' | 'updated' | 'last_used';
export type VaultSortOrder = 'asc' | 'desc';

export interface VaultFilters {
  searchQuery: string;
  selectedFolder: string | null;
  selectedType: ItemType | null;
  selectedTags: string[];
  showFavorites: boolean;
  showDeleted: boolean;
}
