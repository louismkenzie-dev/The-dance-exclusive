import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import PortalLayout from "./PortalLayout";
vi.mock("@/contexts/AuthContext",()=>({useAuth:()=>({user:{id:"test-parent"},profile:null,signOut:vi.fn()})}));
vi.mock("@/components/marketing/PublicSiteShell",()=>({PublicSiteShell:({children}:{children:ReactNode})=><div>{children}</div>}));
vi.mock("@/components/portal/CartDrawer",()=>({default:()=>null}));
vi.mock("@/components/portal/AttendeeOnboarding",()=>({default:()=> <div>Global welcome wizard</div>}));
afterEach(cleanup);
describe("public booking layout",()=>{
 it("lets the class page own attendee setup for a newly signed-in parent",()=>{
  render(<MemoryRouter initialEntries={["/classes/children/test"]}><Routes><Route element={<PortalLayout/>}><Route path="/classes/:type/:classId" element={<p>Class booking</p>}/></Route></Routes></MemoryRouter>);
  expect(screen.getByText("Class booking")).toBeVisible();
  expect(screen.queryByText("Global welcome wizard")).not.toBeInTheDocument();
  expect(document.body).toHaveClass("tde-booking-theme");
  cleanup();expect(document.body).not.toHaveClass("tde-booking-theme");
 });
 it("preserves general onboarding outside the integrated class journey",()=>{
  render(<MemoryRouter initialEntries={["/"]}><Routes><Route element={<PortalLayout/>}><Route path="/" element={<p>Home</p>}/></Route></Routes></MemoryRouter>);
  expect(screen.getByText("Global welcome wizard")).toBeVisible();
 });
});
