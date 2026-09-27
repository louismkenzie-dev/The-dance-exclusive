import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublicClassPage from "./PublicClassPage";
const mocks = vi.hoisted(()=>({ user: null as {id:string}|null, signIn:vi.fn(), signUp:vi.fn() }));
vi.mock("@/contexts/AuthContext",()=>({useAuth:()=>({user:mocks.user,loading:false,signIn:mocks.signIn,signUp:mocks.signUp})}));
vi.mock("@/pages/portal/BookClass",()=>({default:({embedded}:{embedded:boolean})=><section aria-label="Existing booking controls">{embedded ? "Embedded attendee and plan controls" : "Old page"}</section>}));
vi.mock("@/hooks/usePublicSchool",()=>({usePublicSchool:()=>({isPending:false,isError:false,data:{classes:[{id:"white",name:"White Court Street Dance",class_type:"children",age_min:6,age_max:11,day_of_week:"tuesday",start_time:"08:00",end_time:"08:45",price_per_term:91,allow_termly:true,allow_monthly:false,allow_yearly:false,allow_trial:false,capacity:30,enrolled:4,booking_enabled:true,is_active:true,publicly_visible:true,status:"confirmed",remainingSessions:10,sessions:[]}],venues:[],coaches:[]}})}));
function Location(){const l=useLocation();return <output data-testid="route">{l.pathname}{l.hash}</output>;}
function setup(){return render(<MemoryRouter initialEntries={["/classes/children/white"]}><Location/><Routes><Route path="/classes/:type/:classId" element={<PublicClassPage/>}/></Routes></MemoryRouter>);}
afterEach(cleanup);
beforeEach(()=>{mocks.user=null;mocks.signIn.mockReset().mockResolvedValue({error:null});Element.prototype.scrollIntoView=vi.fn();});
describe("unified class and authentication page",()=>{
 it("opens the real sign-in and signup form beneath the class without navigating away",async()=>{
  setup();
  expect(screen.getByRole("heading",{name:"White Court Street Dance"})).toBeVisible();
  fireEvent.click(screen.getByRole("link",{name:"Sign up / sign in to book"}));
  const form=await screen.findByRole("region",{name:"Sign up or sign in to book"},{timeout:5000});
  expect(within(form).getByLabelText("Email")).toBeVisible();
  expect(screen.getByTestId("route")).toHaveTextContent("/classes/children/white");
  fireEvent.click(within(form).getByRole("button",{name:"Create account"}));
  expect(within(form).getByRole("heading",{name:"Create your account"})).toBeVisible();
 });
 it("returns a successful sign-in to this class's booking anchor",async()=>{
  setup();fireEvent.click(screen.getByRole("link",{name:"Sign up / sign in to book"}));
  const form=await screen.findByRole("region",{name:"Sign up or sign in to book"},{timeout:5000});
  fireEvent.change(within(form).getByLabelText("Email"),{target:{value:"test@example.com"}});
  fireEvent.change(within(form).getByLabelText("Password",{exact:true}),{target:{value:"test-only-password"}});
  fireEvent.submit(within(form).getByLabelText("Email").closest("form")!);
  await waitFor(()=>expect(mocks.signIn).toHaveBeenCalledWith("test@example.com","test-only-password"));
  await waitFor(()=>expect(screen.getByTestId("route")).toHaveTextContent("/classes/children/white#choose-place"));
 });
 it("shows existing booking controls inline for an authenticated parent and keeps the class banner",async()=>{
  mocks.user={id:"parent-test"};setup();
  expect(await screen.findByRole("region",{name:"Existing booking controls"})).toHaveTextContent("Embedded attendee and plan controls");
  expect(screen.getByRole("heading",{name:"White Court Street Dance"})).toBeVisible();
  expect(screen.queryByRole("link",{name:"Sign up / sign in to book"})).not.toBeInTheDocument();
 });
});
