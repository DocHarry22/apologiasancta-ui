export const ROOM_ID_STORAGE_KEY = "selectedRoomId";
export const ROOM_NAME_STORAGE_KEY = "selectedRoomName";
export const USER_ID_STORAGE_KEY = "userId";
export const USERNAME_STORAGE_KEY = "playerName";

export type StoredPlayerIdentity = {
  userId: string | null;
  username: string | null;
};

export type StoredRoomSelection = {
  roomId: string | null;
  roomName: string | null;
};

export function readStoredPlayerIdentity(): StoredPlayerIdentity {
  if (typeof window === "undefined") {
    return { userId: null, username: null };
  }

  return {
    userId: localStorage.getItem(USER_ID_STORAGE_KEY),
    username: localStorage.getItem(USERNAME_STORAGE_KEY),
  };
}

export function saveStoredPlayerIdentity(userId: string, username: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_ID_STORAGE_KEY, userId);
  localStorage.setItem(USERNAME_STORAGE_KEY, username);
}

export function clearStoredPlayerIdentity(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_ID_STORAGE_KEY);
  localStorage.removeItem(USERNAME_STORAGE_KEY);
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
