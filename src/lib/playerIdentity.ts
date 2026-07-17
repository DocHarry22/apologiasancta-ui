export const ROOM_ID_STORAGE_KEY = "selectedRoomId";
export const ROOM_NAME_STORAGE_KEY = "selectedRoomName";
export const USER_ID_STORAGE_KEY = "userId";
export const USERNAME_STORAGE_KEY = "playerName";
export const JOIN_TOKEN_STORAGE_KEY = "playerJoinToken";
export const ACCOUNT_SESSION_BINDING_STORAGE_KEY = "playerAccountSessionBinding";
export const AUTH_SESSION_EPOCH_STORAGE_KEY = "playerAuthSessionEpoch";
const LEGACY_DISPLAY_NAME_STORAGE_KEY = "as_player_name";

export const PLAYER_IDENTITY_STORAGE_KEYS = [
  USER_ID_STORAGE_KEY,
  USERNAME_STORAGE_KEY,
  JOIN_TOKEN_STORAGE_KEY,
  ACCOUNT_SESSION_BINDING_STORAGE_KEY,
  AUTH_SESSION_EPOCH_STORAGE_KEY,
] as const;

export type StoredPlayerIdentity = {
  userId: string | null;
  username: string | null;
  joinToken: string | null;
  accountSessionBinding: string | null;
};

export type StoredRoomSelection = {
  roomId: string | null;
  roomName: string | null;
};

export function readStoredPlayerIdentity(): StoredPlayerIdentity {
  if (typeof window === "undefined") {
    return { userId: null, username: null, joinToken: null, accountSessionBinding: null };
  }

  return {
    userId: localStorage.getItem(USER_ID_STORAGE_KEY),
    username: localStorage.getItem(USERNAME_STORAGE_KEY),
    joinToken: localStorage.getItem(JOIN_TOKEN_STORAGE_KEY),
    accountSessionBinding: localStorage.getItem(ACCOUNT_SESSION_BINDING_STORAGE_KEY),
  };
}

export function isStoredAccountPlayerIdentity(identity: StoredPlayerIdentity): boolean {
  // `acct_` migrates credentials created by the first bridge release, before
  // session binding metadata existed. Such unbound account credentials are
  // deliberately cleared instead of silently resumed.
  return Boolean(identity.accountSessionBinding) || Boolean(identity.userId?.startsWith("acct_"));
}

/**
 * Monotonic browser marker for account/session transitions. It is deliberately
 * retained when player credentials are cleared so an in-flight request can
 * detect a logout or account switch that happened after it was dispatched.
 */
export function readAuthSessionEpoch(): number {
  if (typeof window === "undefined") return 0;
  const parsed = Number(localStorage.getItem(AUTH_SESSION_EPOCH_STORAGE_KEY));
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export function bumpAuthSessionEpoch(): number {
  if (typeof window === "undefined") return 0;
  const next = Math.max(Date.now(), readAuthSessionEpoch() + 1);
  localStorage.setItem(AUTH_SESSION_EPOCH_STORAGE_KEY, String(next));
  return next;
}

export function isAuthSessionEpochCurrent(capturedEpoch: number): boolean {
  return readAuthSessionEpoch() === capturedEpoch;
}

/**
 * Synchronous fail-closed boundary for any request that may establish,
 * rotate, or destroy the UI account session. Call before dispatch so a lost
 * HTTP response cannot leave an older Engine credential active.
 */
export function invalidateStoredAccountPlayerSession(): number {
  const nextEpoch = bumpAuthSessionEpoch();
  clearStoredAccountPlayerIdentity();
  return nextEpoch;
}

export async function runWithStoredAccountSessionBoundary<T>(
  operation: () => Promise<T>
): Promise<T> {
  invalidateStoredAccountPlayerSession();
  try {
    return await operation();
  } finally {
    // A second epoch closes the interval in which another tab could start an
    // Engine exchange under the pre-transition cookie. This also runs when the
    // HTTP response is rejected or lost.
    invalidateStoredAccountPlayerSession();
  }
}

export function saveStoredPlayerIdentity(userId: string, username: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_ID_STORAGE_KEY, userId);
  localStorage.setItem(USERNAME_STORAGE_KEY, username);
}

export function saveStoredJoinToken(joinToken: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(JOIN_TOKEN_STORAGE_KEY, joinToken);
}

export function saveStoredAccountPlayerIdentity(
  userId: string,
  username: string,
  joinToken: string,
  sessionBinding: string
): void {
  if (typeof window === "undefined") return;
  saveStoredPlayerIdentity(userId, username);
  saveStoredJoinToken(joinToken);
  localStorage.setItem(ACCOUNT_SESSION_BINDING_STORAGE_KEY, sessionBinding);
}

export function saveStoredGuestPlayerIdentity(
  userId: string,
  username: string,
  joinToken?: string | null
): void {
  if (typeof window === "undefined") return;
  saveStoredPlayerIdentity(userId, username);
  if (joinToken) saveStoredJoinToken(joinToken);
  else clearStoredJoinToken();
  localStorage.removeItem(ACCOUNT_SESSION_BINDING_STORAGE_KEY);
}

export function clearStoredAccountPlayerIdentity(): boolean {
  const identity = readStoredPlayerIdentity();
  if (!isStoredAccountPlayerIdentity(identity)) return false;
  clearStoredPlayerIdentity();
  return true;
}

export function clearStoredJoinToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(JOIN_TOKEN_STORAGE_KEY);
}

export function clearStoredPlayerIdentity(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_ID_STORAGE_KEY);
  localStorage.removeItem(USERNAME_STORAGE_KEY);
  localStorage.removeItem(JOIN_TOKEN_STORAGE_KEY);
  localStorage.removeItem(ACCOUNT_SESSION_BINDING_STORAGE_KEY);
  localStorage.removeItem(LEGACY_DISPLAY_NAME_STORAGE_KEY);
}

export function readStoredRoomSelection(): StoredRoomSelection {
  if (typeof window === "undefined") {
    return { roomId: null, roomName: null };
  }

  return {
    roomId: localStorage.getItem(ROOM_ID_STORAGE_KEY),
    roomName: localStorage.getItem(ROOM_NAME_STORAGE_KEY),
  };
}

export function saveStoredRoomSelection(roomId: string, roomName: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ROOM_ID_STORAGE_KEY, roomId);
  localStorage.setItem(ROOM_NAME_STORAGE_KEY, roomName);
}
