import { useStaffMember } from "@/hooks/useStaffMember";
import { RegisterScreen } from "@/components/registers/RegisterScreen";

/** A teacher's registers: the classes they take, as an app for the door. */
const StaffRegisters = () => {
  const { staff } = useStaffMember();
  return <RegisterScreen scope={{ kind: "staff", staffId: staff?.id ?? null }} />;
};

export default StaffRegisters;
