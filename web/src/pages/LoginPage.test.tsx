import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginPage } from "./LoginPage.js";
import { SessionProvider } from "../session-context.js";
import { ApiError, type ApiClient } from "../api/client.js";
import { createSession, type StorageLike } from "../auth/session.js";

function fakeStorage(): StorageLike {
  const entries = new Map<string, string>();
  return {
    getItem: (k) => entries.get(k) ?? null,
    setItem: (k, v) => void entries.set(k, v),
    removeItem: (k) => void entries.delete(k),
  };
}

let session: ReturnType<typeof createSession>;
let api: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

beforeEach(() => {
  session = createSession(fakeStorage());
  api = { get: vi.fn(), post: vi.fn() };
});

const renderPage = () =>
  render(
    <SessionProvider session={session} api={api as unknown as ApiClient}>
      <LoginPage />
    </SessionProvider>,
  );

describe("LoginPage", () => {
  it("sends the credentials to the login endpoint", async () => {
    api.post.mockResolvedValueOnce({
      access_token: "a",
      refresh_token: "r",
      user: { id: "u1", email: "p@example.com", name: "Partner", role: "photographer" },
    });

    renderPage();
    await userEvent.type(screen.getByLabelText("Email"), "p@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "hunter2");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/auth/login", {
        email: "p@example.com",
        password: "hunter2",
      }),
    );
  });

  it("signs the session in on success", async () => {
    const user = { id: "u1", email: "p@example.com", name: "Partner", role: "photographer" };
    api.post.mockResolvedValueOnce({ access_token: "a", refresh_token: "r", user });

    renderPage();
    await userEvent.type(screen.getByLabelText("Email"), "p@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "hunter2");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(session.getUser()).toEqual(user));
    expect(session.getAccessToken()).toBe("a");
  });

  it("shows the server's message and does not sign in on a rejection", async () => {
    api.post.mockRejectedValueOnce(
      new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect."),
    );

    renderPage();
    await userEvent.type(screen.getByLabelText("Email"), "p@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email or password is incorrect.",
    );
    expect(session.getUser()).toBeNull();
  });

  it("does not reveal whether the email exists", async () => {
    api.post.mockRejectedValueOnce(
      new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect."),
    );

    renderPage();
    await userEvent.type(screen.getByLabelText("Email"), "nobody@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "hunter2");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).not.toMatch(/unknown|no such|not found|no account/i);
  });

  it("falls back to a generic message when the failure is not an ApiError", async () => {
    api.post.mockRejectedValueOnce(new Error("boom"));

    renderPage();
    await userEvent.type(screen.getByLabelText("Email"), "p@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "hunter2");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong.");
  });

  it("clears a previous error when the form is resubmitted", async () => {
    api.post
      .mockRejectedValueOnce(new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect."))
      .mockResolvedValueOnce({
        access_token: "a",
        refresh_token: "r",
        user: { id: "u1", email: "p@example.com", name: "Partner", role: "photographer" },
      });

    renderPage();
    await userEvent.type(screen.getByLabelText("Email"), "p@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByRole("alert");

    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
});
