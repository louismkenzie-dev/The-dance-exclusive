import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuickBookDialog, type QuickBookClass } from "./QuickBookDialog";
const {addItem} = vi.hoisted(() => ({addItem:vi.fn()}));
vi.mock("@/contexts/AuthContext",()=>({useAuth:()=>({user:{id:"parent-test"}})}));
vi.mock("@/contexts/CartContext",()=>({useCart:()=>({addItem,items:[]})}));
vi.mock("@/components/portal/ChildFormDialog",()=>({ChildFormDialog:({open}:{open:boolean})=>open?<div role="dialog">Attendee profile</div>:null}));
const cls: QuickBookClass = {id:"test-class",name:"Street crew",class_type:"children",dance_style:"Street",day_of_week:"monday",start_time:"17:00",end_time:"18:00",age_min:3,age_max:17,price_per_session:8,price_per_month:30,price_per_term:91,price_per_year:300,term_discount_percent:0,monthly_discount_percent:0,allow_trial:true,allow_monthly:true,allow_termly:true,allow_yearly:false,venues:{name:"Town Hall"},workshops:null};
const children=[{id:"child-test",first_name:"Test",last_name:"Dancer",preferred_name:null,date_of_birth:"2018-01-01"}];
const sessions=[{id:"date-test",session_date:"2026-10-05",start_time:"17:00",end_time:"18:00"}];
function setup(props:Partial<React.ComponentProps<typeof QuickBookDialog>>={}) {
  return render(<MemoryRouter><QuickBookDialog inline open onOpenChange={vi.fn()} classData={cls} sessions={sessions} children={children} hasExistingBookings={true} isAdult={false} {...props}/></MemoryRouter>);
}
afterEach(cleanup);
beforeEach(()=>{addItem.mockClear();Element.prototype.scrollIntoView=vi.fn();});
describe("on-page booking",()=>{
  it("keeps plan and attendee controls on the page and adds the existing booking payload",()=>{
    setup({presetPlan:"term"});
    expect(screen.getByRole("region",{name:"Choose your place"})).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox",{name:/Test/}));
    fireEvent.click(screen.getByRole("button",{name:"Add to basket"}));
    expect(addItem).toHaveBeenCalledWith(expect.objectContaining({classId:"test-class",studentId:"child-test",pricingPlan:"term",selectedSessionIds:["date-test"],totalPrice:91}));
    expect(screen.getByRole("region",{name:"Choose your place"})).toBeVisible();
  });
  it("retains monthly notice acknowledgement before adding a membership",()=>{
    setup({presetPlan:"monthly"});
    fireEvent.click(screen.getByRole("checkbox",{name:/Test/}));
    fireEvent.click(screen.getByRole("button",{name:"Add to basket"}));
    const notice=screen.getByRole("alertdialog");
    expect(within(notice).getByText("Before you join monthly")).toBeVisible();
    expect(addItem).not.toHaveBeenCalled();
    fireEvent.click(within(notice).getByRole("button",{name:"I agree, add to basket"}));
    expect(addItem).toHaveBeenCalledWith(expect.objectContaining({pricingPlan:"monthly",studentId:"child-test"}));
  });
  it("offers trials only after eligibility is known",()=>{
    const {rerender}=setup({hasExistingBookings:null});
    expect(screen.queryByRole("radio",{name:/trial/i})).not.toBeInTheDocument();
    rerender(<MemoryRouter><QuickBookDialog inline open onOpenChange={vi.fn()} classData={cls} sessions={sessions} children={children} hasExistingBookings={false} isAdult={false}/></MemoryRouter>);
    expect(screen.getByRole("radio",{name:/trial/i})).toBeVisible();
  });
  it("opens attendee setup in place instead of adding a booking without a child",()=>{
    setup({children:[]});
    fireEvent.click(screen.getAllByRole("button",{name:"Add a child"})[0]);
    expect(screen.getByRole("dialog")).toHaveTextContent("Attendee profile");
    expect(addItem).not.toHaveBeenCalled();
  });
});
