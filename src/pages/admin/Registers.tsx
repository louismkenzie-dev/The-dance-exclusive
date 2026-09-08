import { RegisterScreen } from "@/components/registers/RegisterScreen";

/** The studio's registers: every class and event day, any venue, any date. */
const AdminRegisters = () => <RegisterScreen scope={{ kind: "all" }} />;

export default AdminRegisters;
