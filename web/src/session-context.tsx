import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { createApiClient, type ApiClient } from "./api/client.js";
import { createSession, type Session, type SessionUser } from "./auth/session.js";
import { API_BASE_URL } from "./config.js";

interface SessionContextValue {
  session: Session;
  api: ApiClient;
  user: SessionUser | null;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface ProviderProps {
  children: ReactNode;
  /** Injected in tests; production builds use the real session and client. */
  session?: Session;
  api?: ApiClient;
}

export function SessionProvider({ children, session, api }: ProviderProps) {
  const value = useMemo(() => {
    const activeSession = session ?? createSession();
    return {
      session: activeSession,
      api: api ?? createApiClient({ baseUrl: API_BASE_URL, session: activeSession }),
    };
  }, [session, api]);

  const [user, setUser] = useState<SessionUser | null>(() => value.session.getUser());

  useEffect(() => value.session.subscribe(() => setUser(value.session.getUser())), [value]);

  return (
    <SessionContext.Provider value={{ ...value, user }}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (context === null) throw new Error("useSession must be used inside a SessionProvider");
  return context;
}
