import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import PortalLayout from "./PortalLayout";
vi.mock("@/contexts/AuthContext",()=>({useAuth:()=>({user:{id:"test-parent"},profile:null,signOut:vi.fn()})}));
vi.mock("@/components/marketing/PublicSiteShell",()=>({PublicSiteShell:({children,product,focus}:{children:ReactNode;product?:boolean;focus?:boolean})=><div data-testid="shell" data-product={!!product} data-focus={!!focus}>{children}</div>}));
vi.mock("@/components/portal/CartDrawer",()=>({default:()=>null}));
vi.mock("@/components/portal/AttendeeOnboarding",()=>({default:()=> <div>Global welcome wizard</div>}));
afterEach(cleanup);
describe("public booking layout",()=>{
 it("lets the class page own attendee setup for a newly signed-in parent",()=>{
  render(<MemoryRouter initialEntries={["/classes/children/test"]}><Routes><Route element={<PortalLayout/>}><Route path="/classes/:type/:classId" element={<p>Class booking</p>}/></Route></Routes></MemoryRouter>);
  expect(screen.getByText("Class booking")).toBeVisible();
  expect(screen.queryByText("Global welcome wizard")).not.toBeInTheDocument();
  expect(screen.getByTestId("shell")).toHaveAttribute("data-product", "false");
 });
 it.each(["/checkout", "/checkout/return", "/book/example"])("keeps %s focused without global onboarding", (path)=>{
  render(<MemoryRouter initialEntries={[path]}><Routes><Route element={<PortalLayout/>}><Route path="*" element={<p>Booking task</p>}/></Route></Routes></MemoryRouter>);
  expect(screen.getByTestId("shell")).toHaveAttribute("data-product", "true");
  expect(screen.getByTestId("shell")).toHaveAttribute("data-focus", String(path.startsWith("/checkout")));
  expect(screen.queryByText("Global welcome wizard")).not.toBeInTheDocument();
 });
 it("preserves general onboarding outside the integrated class journey",()=>{
  render(<MemoryRouter initialEntries={["/"]}><Routes><Route element={<PortalLayout/>}><Route path="/" element={<p>Home</p>}/></Route></Routes></MemoryRouter>);
  expect(screen.getByText("Global welcome wizard")).toBeVisible();
 });
});
