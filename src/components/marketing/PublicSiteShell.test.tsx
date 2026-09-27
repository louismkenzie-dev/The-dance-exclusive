import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PublicSiteShell } from "./PublicSiteShell";
vi.mock("@/contexts/AuthContext", () => ({useAuth: () => ({user: {id: "parent"}, signOut: vi.fn()})}));
vi.mock("@/hooks/usePublicSchool", () => ({usePublicSchool: () => ({data: null})}));
vi.mock("@/components/portal/CartButton", () => ({default: () => <button>Open basket</button>}));
afterEach(cleanup);
describe("customer design shell", () => {
 it("themes portalled controls and removes the customer theme on leaving", () => {
  const {unmount} = render(<MemoryRouter initialEntries={["/account"]}><PublicSiteShell product><p>Account</p></PublicSiteShell></MemoryRouter>);
  expect(document.body).toHaveClass("tde-customer-theme");
  expect(document.body).not.toHaveClass("tde-customer-adult");
  expect(screen.getByRole("navigation",{name:"Main navigation"})).toHaveTextContent("My bookings");
  unmount();
  expect(document.body).not.toHaveClass("tde-customer-theme");
 });
 it.each(["/classes/adult", "/classes?type=adult"])("limits pink accents to adult context %s", (path) => {
  render(<MemoryRouter initialEntries={[path]}><PublicSiteShell><p>Adult classes</p></PublicSiteShell></MemoryRouter>);
  expect(document.body).toHaveClass("tde-customer-adult");
 });
 it("keeps payment tasks free of competing basket and bottom navigation", () => {
  render(<MemoryRouter initialEntries={["/checkout"]}><PublicSiteShell product focus><p>Checkout</p></PublicSiteShell></MemoryRouter>);
  expect(screen.queryByRole("button",{name:"Open basket"})).not.toBeInTheDocument();
  expect(screen.queryByRole("navigation",{name:"Quick navigation"})).not.toBeInTheDocument();
  expect(screen.getByRole("link",{name:"The Dance Exclusive home"})).toBeInTheDocument();
 });
});
