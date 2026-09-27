import {render,screen} from "@testing-library/react";
import {MemoryRouter,Route,Routes,useLocation} from "react-router-dom";
import {expect,it,vi} from "vitest";
import ProtectedRoute from "./ProtectedRoute";
vi.mock("@/contexts/AuthContext",()=>({useAuth:()=>({user:null,loading:false,role:null})}));
function AuthDestination(){const {search}=useLocation();return <p>{new URLSearchParams(search).get("redirect")}</p>}
it("returns a signed-out visitor to the requested booking task after sign-in",()=>{
 render(<MemoryRouter initialEntries={["/checkout?from=basket#summary"]}><Routes><Route path="/checkout" element={<ProtectedRoute><p>Checkout</p></ProtectedRoute>}/><Route path="/auth" element={<AuthDestination/>}/></Routes></MemoryRouter>);
 expect(screen.getByText("/checkout?from=basket#summary")).toBeInTheDocument();
});
