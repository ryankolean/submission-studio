import { beforeEach, describe, expect, it } from "vitest";

import { createSession } from "./session.js";
import type { StorageLike } from "./session.js";

/** A Storage stand-in, so these tests do not depend on the jsdom global. */
function fakeStorage(): StorageLike & { size(): number; dump(): string } {
  const entries = new Map<string, string>();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, value),
    removeItem: (key) => void entries.delete(key),
    size: () => entries.size,
    dump: () => JSON.stringify([...entries]),
  };
}

let storage: ReturnType<typeof fakeStorage>;

const USER = { id: "u1", email: "p@example.com", name: "Partner", role: "photographer" } as const;

beforeEach(() => {
  storage = fakeStorage();
});

describe("createSession", () => {
  it("starts signed out", () => {
    const session = createSession(storage);
    expect(session.getAccessToken()).toBeNull();
    expect(session.getUser()).toBeNull();
  });

  it("holds the access token after sign-in", () => {
    const session = createSession(storage);
    session.signIn({ accessToken: "access", refreshToken: "refresh", user: USER });
    expect(session.getAccessToken()).toBe("access");
    expect(session.getUser()).toEqual(USER);
  });

  it("keeps the access token out of storage, where a script could read it", () => {
    const session = createSession(storage);
    session.signIn({ accessToken: "access", refreshToken: "refresh", user: USER });
    expect(storage.dump()).not.toContain("access");
  });

  it("persists the refresh token so a reload does not force a new login", () => {
    createSession(storage).signIn({ accessToken: "access", refreshToken: "refresh", user: USER });
    expect(createSession(storage).getRefreshToken()).toBe("refresh");
  });

  it("forgets everything on sign-out", () => {
    const session = createSession(storage);
    session.signIn({ accessToken: "access", refreshToken: "refresh", user: USER });
    session.signOut();
    expect(session.getAccessToken()).toBeNull();
    expect(session.getRefreshToken()).toBeNull();
    expect(session.getUser()).toBeNull();
    expect(storage.size()).toBe(0);
  });

  it("survives storage holding something that is not json", () => {
    storage.setItem("publication-studio.session", "{not json");
    expect(createSession(storage).getRefreshToken()).toBeNull();
  });

  it("ignores a stored value of the wrong shape", () => {
    storage.setItem("publication-studio.session", JSON.stringify({ nope: 1 }));
    expect(createSession(storage).getRefreshToken()).toBeNull();
    expect(createSession(storage).getUser()).toBeNull();
  });

  it("notifies subscribers when the session changes", () => {
    const session = createSession(storage);
    const seen: Array<string | null> = [];
    session.subscribe(() => seen.push(session.getAccessToken()));

    session.signIn({ accessToken: "a", refreshToken: "r", user: USER });
    session.signOut();

    expect(seen).toEqual(["a", null]);
  });

  it("stops notifying after unsubscribe", () => {
    const session = createSession(storage);
    let calls = 0;
    const unsubscribe = session.subscribe(() => {
      calls++;
    });
    unsubscribe();
    session.signIn({ accessToken: "a", refreshToken: "r", user: USER });
    expect(calls).toBe(0);
  });

  it("replaces only the access token on refresh", () => {
    const session = createSession(storage);
    session.signIn({ accessToken: "old", refreshToken: "refresh", user: USER });
    session.setAccessToken("new");
    expect(session.getAccessToken()).toBe("new");
    expect(session.getRefreshToken()).toBe("refresh");
    expect(session.getUser()).toEqual(USER);
  });
});
