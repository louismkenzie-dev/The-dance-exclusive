import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClassSignupBanner } from "./ClassSignupBanner";

const auth = vi.hoisted(() => ({ user: null as { id: string } | null, loading: false, signIn: vi.fn(), signUp: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
function Location() {
  const location = useLocation();
  return <output data-testid="route">{location.pathname}{location.search}</output>;
}
function setup() {
  return render(<MemoryRouter initialEntries={["/classes?type=children&day=monday"]}><Location /><ClassSignupBanner /></MemoryRouter>);
}
afterEach(cleanup);
beforeEach(() => { auth.user = null; auth.loading = false; auth.signIn.mockReset(); });

describe("class discovery signup banner", () => {
  it("opens signup in a popup and keeps filters after switching to sign-in", async () => {
    auth.signIn.mockImplementation(async () => { auth.user = { id: "parent-test" }; return { error: null }; });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Sign up / sign in" }));
    const dialog = screen.getByRole("dialog", { name: "Sign up or sign in" });
    expect(await within(dialog).findByRole("heading", { name: "Create your account" })).toBeVisible();
    fireEvent.click(within(dialog).getByRole("button", { name: "Sign in", exact: true }));
    fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "test@example.com" } });
    fireEvent.change(within(dialog).getByLabelText("Password", { exact: true }), { target: { value: "test-only-password" } });
    fireEvent.submit(within(dialog).getByLabelText("Email").closest("form")!);
    await waitFor(() => expect(auth.signIn).toHaveBeenCalledWith("test@example.com", "test-only-password"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByTestId("route")).toHaveTextContent("/classes?type=children&day=monday");
    expect(screen.queryByRole("button", { name: "Sign up / sign in" })).not.toBeInTheDocument();
  });

  it("hides the promotion for signed-in visitors", () => {
    auth.user = { id: "parent-test" };
    setup();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
