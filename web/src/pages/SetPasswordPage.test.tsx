import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SetPasswordPage } from "./SetPasswordPage.js";
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

let api: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

beforeEach(() => {
  api = { get: vi.fn(), post: vi.fn() };
});

const renderPage = (search = "?token=invite-token-abc") =>
  render(
    <MemoryRouter initialEntries={[`/set-password${search}`]}>
      <SessionProvider session={createSession(fakeStorage())} api={api as unknown as ApiClient}>
        <SetPasswordPage />
      </SessionProvider>
    </MemoryRouter>,
  );

const fill = async (password: string, confirmation = password) => {
  await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.type(screen.getByLabelText("Confirm password"), confirmation);
  await userEvent.click(screen.getByRole("button", { name: "Set password" }));
};

describe("SetPasswordPage", () => {
  it("sends the token from the link with the chosen password", async () => {
    api.post.mockResolvedValueOnce(undefined);
    renderPage();
    await fill("correct horse battery staple");

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/auth/set-password", {
        token: "invite-token-abc",
        password: "correct horse battery staple",
      }),
    );
  });

  it("confirms success and offers the way in", async () => {
    api.post.mockResolvedValueOnce(undefined);
    renderPage();
    await fill("correct horse battery staple");

    expect(await screen.findByText(/Your password is set/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to sign in" })).toBeInTheDocument();
  });

  it("catches a mismatch without troubling the server", async () => {
    renderPage();
    await fill("correct horse battery staple", "something else entirely");

    expect(await screen.findByRole("alert")).toHaveTextContent("do not match");
    expect(api.post).not.toHaveBeenCalled();
  });

  it("shows the server's policy message", async () => {
    api.post.mockRejectedValueOnce(
      new ApiError(400, "VALIDATION", "Use at least 12 characters."),
    );
    renderPage();
    await fill("short");

    expect(await screen.findByRole("alert")).toHaveTextContent("Use at least 12 characters.");
  });

  it("shows the server's message for a spent or unknown invite", async () => {
    api.post.mockRejectedValueOnce(
      new ApiError(400, "VALIDATION", "That invite link is not valid. Ask for a new one."),
    );
    renderPage();
    await fill("correct horse battery staple");

    expect(await screen.findByRole("alert")).toHaveTextContent("not valid");
    expect(screen.queryByText(/Your password is set/)).not.toBeInTheDocument();
  });

  it("explains a link that carries no token", () => {
    renderPage("");
    expect(screen.getByRole("alert")).toHaveTextContent("missing its invite token");
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  it("does not put the token in the page text", () => {
    const { container } = renderPage();
    expect(container.textContent).not.toContain("invite-token-abc");
  });
});
