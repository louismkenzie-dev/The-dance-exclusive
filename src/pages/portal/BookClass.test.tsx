import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BookClass from "./BookClass";
const mocks=vi.hoisted(()=>({user:{id:"test-parent"},studentError:false,addItem:vi.fn()}));
vi.mock("@/contexts/AuthContext",()=>({useAuth:()=>({user:mocks.user})}));
vi.mock("@/contexts/CartContext",()=>({useCart:()=>({addItem:mocks.addItem,items:[]})}));
vi.mock("@/components/portal/ChildFormDialog",()=>({ChildFormDialog:()=>null}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{
 from:(table:string)=>{
  const result=()=>({data:table==="classes"?{id:"test-class",name:"Street crew",class_type:"children",day_of_week:"monday",start_time:"17:00",end_time:"18:00",is_active:true,publicly_visible:true,status:"confirmed",booking_enabled:true,capacity:30,price_per_term:91,price_per_month:30,price_per_session:8,allow_termly:true,allow_monthly:false,allow_yearly:false,allow_trial:false,venues:{name:"Town Hall",address_line1:"High Street",directions:"Use the side door",drop_off_info:"Meet your coach inside",has_parking:true,parking_details:"At the back"}}:table==="class_sessions"?[{id:"test-date",class_id:"test-class",session_date:"2099-10-05",start_time:"17:00",end_time:"18:00"}]:table==="students"?(mocks.studentError?null:[{id:"test-child",first_name:"Test",last_name:"Dancer",date_of_birth:"2018-01-01",is_self:false}]):[],error:table==="students"&&mocks.studentError?{message:"Unavailable"}:null,count:1});
  const chain={select:()=>chain,eq:()=>chain,in:()=>chain,order:()=>chain,maybeSingle:()=>Promise.resolve(result()),then:(resolve:(r:unknown)=>unknown)=>Promise.resolve(result()).then(resolve)};return chain;
 },rpc:()=>Promise.resolve({data:[{class_id:"test-class",confirmed_count:4}]}),
}}));
afterEach(cleanup);
beforeEach(()=>{mocks.studentError=false;mocks.addItem.mockClear();Element.prototype.scrollIntoView=vi.fn();});
function setup(){render(<MemoryRouter initialEntries={["/classes/children/test-class"]}><Routes><Route path="/classes/:type/:classId" element={<BookClass embedded/>}/></Routes></MemoryRouter>);}
describe("embedded full class booking",()=>{
 it("keeps venue instructions, dates and working attendee booking together",async()=>{
  setup();
  const booking=await screen.findByRole("region",{name:"Choose your place"});
  expect(screen.getByText(/Use the side door/)).toBeVisible();
  expect(screen.getByText(/Meet your coach inside/)).toBeVisible();
  fireEvent.click(within(booking).getByRole("checkbox",{name:/Test/}));
  fireEvent.click(within(booking).getByRole("button",{name:"Add to basket"}));
  expect(mocks.addItem).toHaveBeenCalledWith(expect.objectContaining({classId:"test-class",studentId:"test-child",pricingPlan:"term",totalPrice:91,selectedSessionIds:["test-date"]}));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
 });
 it("provides retry when attendee lookup fails and never offers an empty profile as the result",async()=>{
  mocks.studentError=true;setup();
  expect(await screen.findByText(/We couldn’t load your attendee profiles/)).toBeVisible();
  expect(screen.queryByRole("region",{name:"Choose your place"})).not.toBeInTheDocument();
  mocks.studentError=false;fireEvent.click(screen.getByRole("button",{name:"Try again"}));
  expect(await screen.findByRole("checkbox",{name:/Test/})).toBeVisible();
 });
});
