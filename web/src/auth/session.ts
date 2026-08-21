export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface SignInPayload {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

const STORAGE_KEY = "submission-studio.session";

/** The slice of the Storage API this module uses. Injected so it can be faked. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * DECISION: the access token is held in memory only; the refresh token and the
 * user are persisted so a reload does not force a new login.
 *
 * The refresh token in localStorage is readable by any script running on the
 * page, which is the accepted cost of a cross-origin SPA that calls a Worker on
 * another origin. The upgrade path is an httpOnly, SameSite=None cookie issued
 * by the Worker, which also brings CSRF handling with it. Flagged for Ryan
 * rather than decided here.
 */
export interface Session {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  getUser(): SessionUser | null;
  signIn(payload: SignInPayload): void;
  setAccessToken(token: string): void;
  signOut(): void;
  subscribe(listener: () => void): () => void;
}

interface Persisted {
  refreshToken: string;
  user: SessionUser;
}

function isSessionUser(value: unknown): value is SessionUser {
  if (typeof value !== "object" || value === null) return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user["id"] === "string" &&
    typeof user["email"] === "string" &&
    typeof user["name"] === "string" &&
    typeof user["role"] === "string"
  );
}

/** Storage is user-writable and survives deploys; treat whatever is there as suspect. */
function readPersisted(storage: StorageLike): Persisted | null {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const candidate = parsed as Record<string, unknown>;
    if (typeof candidate["refreshToken"] !== "string") return null;
    if (!isSessionUser(candidate["user"])) return null;
    return { refreshToken: candidate["refreshToken"], user: candidate["user"] };
  } catch {
    return null;
  }
}

export function createSession(
  storage: StorageLike = window.localStorage,
): Session {
  const persisted = readPersisted(storage);

  let accessToken: string | null = null;
  let refreshToken: string | null = persisted?.refreshToken ?? null;
  let user: SessionUser | null = persisted?.user ?? null;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) listener();
  };

  return {
    getAccessToken: () => accessToken,
    getRefreshToken: () => refreshToken,
    getUser: () => user,

    signIn(payload) {
      accessToken = payload.accessToken;
      refreshToken = payload.refreshToken;
      user = payload.user;
      storage.setItem(
        STORAGE_KEY,
        JSON.stringify({ refreshToken: payload.refreshToken, user: payload.user }),
      );
      notify();
    },

    setAccessToken(token) {
      accessToken = token;
      notify();
    },

    signOut() {
      accessToken = null;
      refreshToken = null;
      user = null;
      storage.removeItem(STORAGE_KEY);
      notify();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
