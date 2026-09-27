import {cleanup,render,screen} from "@testing-library/react";
import {MemoryRouter,Route,Routes,useLocation} from "react-router-dom";
import {afterEach,expect,it,vi} from "vitest";
import LegacyClassLink from "./LegacyClassLink";
vi.mock("@/hooks/usePublicSchool",()=>({usePublicSchool:()=>({data:{classes:[{id:"class-1",class_type:"adult"}]},isPending:false,isError:false})}));
function Destination(){const {pathname,search,hash}=useLocation();return <p>{pathname}{search}{hash}</p>}
afterEach(cleanup);
it("keeps old shared class links and their booking intent in the integrated page",()=>{
 render(<MemoryRouter initialEntries={["/book/class-1?source=timetable#choose-place"]}><Routes><Route path="/book/:classId" element={<LegacyClassLink/>}/><Route path="/classes/:type/:classId" element={<Destination/>}/></Routes></MemoryRouter>);
 expect(screen.getByText("/classes/adult/class-1?source=timetable#choose-place")).toBeInTheDocument();
});
