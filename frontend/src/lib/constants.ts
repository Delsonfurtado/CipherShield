export const APP_NAME = "CipherShield";
export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";
export const DEFAULT_INACTIVITY_TIMEOUT_SEC = 300; // 5 minutes
export const DEFAULT_CLIPBOARD_TIMEOUT_SEC = 30; // 30 seconds

export const KDF_DEFAULT_PARAMS = {
  m: 65536, // 64 MB
  t: 3,     // 3 iterations
  p: 1,     // 1 parallelism
};
