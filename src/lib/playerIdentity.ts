export const ROOM_ID_STORAGE_KEY = "selectedRoomId";
export const ROOM_NAME_STORAGE_KEY = "selectedRoomName";
export const USER_ID_STORAGE_KEY = "userId";
export const USERNAME_STORAGE_KEY = "playerName";
export const JOIN_TOKEN_STORAGE_KEY = "playerJoinToken";
export const ACCOUNT_SESSION_BINDING_STORAGE_KEY = "playerAccountSessionBinding";
const LEGACY_DISPLAY_NAME_STORAGE_KEY = "as_player_name";

export const PLAYER_IDENTITY_STORAGE_KEYS = [
  USER_ID_STORAGE_KEY,
  USERNAME_STORAGE_KEY,
  JOIN_TOKEN_STORAGE_KEY,
  ACCOUNT_SESSION_BINDING_STORAGE_KEY,
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
