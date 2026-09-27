import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PublicTimetable } from "./PublicTimetable";
import type { PublicClass, PublicVenue } from "@/lib/publicSchool";
const venues = [{id:"a",name:"Town Hall"},{id:"b",name:"School Hall"}] as PublicVenue[];
const classes = [{id:"one", name:"Junior street",class_type:"children",venue_id:"a",age_min:6,price_per_term:91,allow_termly:true,allow_monthly:false,allow_yearly:false,remainingSessions:10,sessions:[{id:"s1",session_date:"2026-10-05",start_time:"17:00",end_time:"18:00"},{id:"s2",session_date:"2026-10-12",start_time:"17:00",end_time:"18:00"}]},{id:"two",name:"Mini crew",class_type:"children",venue_id:"b",age_min:3,remainingSessions:10,sessions:[{id:"s3",session_date:"2026-10-06",start_time:"16:00",end_time:"17:00"}]}] as PublicClass[];
beforeAll(() => { Element.prototype.scrollIntoView = vi.fn(); });
afterEach(cleanup);
describe("public timetable shared with booking", () => {
  it("filters by date and venue while retaining links to the full class page", () => {
    render(<MemoryRouter><PublicTimetable classes={classes} venues={venues}/></MemoryRouter>);
    expect(screen.getByText(/Showing 3 of 3/)).toBeVisible();
    fireEvent.click(screen.getByRole("option",{name:"Tuesday 6 October"}));
    expect(screen.getByText("Mini crew")).toBeVisible();
    expect(screen.queryByText("Junior street")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox",{name:"Venue"}),{target:{value:"a"}});
    expect(screen.getAllByText("Junior street")).toHaveLength(2);
    expect(screen.queryByText("Mini crew")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link",{name:"View class"})[0]).toHaveAttribute("href","/classes/children/one");
    expect(screen.getAllByText(/£91\.00 \/term/)).toHaveLength(2);
  });
  it("explains when dates have not been published", () => {
    render(<MemoryRouter><PublicTimetable classes={[{...classes[0],sessions:[]}]} venues={venues}/></MemoryRouter>);
    expect(screen.getByRole("status")).toHaveTextContent("No upcoming sessions are published");
  });
});
