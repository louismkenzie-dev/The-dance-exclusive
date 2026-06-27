import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface StaffMember {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  is_active: boolean;
  date_of_birth: string | null;
  description: string | null;
  drives: boolean;
  self_employed: boolean;
  pay_per_hour: number | null;
  dance_skills: string[];
  profile_photo: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  next_of_kin_name: string | null;
  next_of_kin_phone: string | null;
  next_of_kin_relationship: string | null;
  dbs_certificate_front: string | null;
  dbs_certificate_back: string | null;
  dbs_number: string | null;
  dbs_issue_date: string | null;
  pli_certificate: string | null;
  pli_cover_level: string | null;
  user_id: string | null;
}

export const useStaffMember = () => {
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStaff = async () => {
    if (!user?.id) {
      setStaff(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("staff")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    setStaff((data as any) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    void fetchStaff();
  }, [user?.id]);

  return { staff, loading, refresh: fetchStaff };
};

export const getStaffPhotoUrl = (path: string | null | undefined) => {
  if (!path) return undefined;
  const { data } = supabase.storage.from("staff-photos").getPublicUrl(path);
  return data.publicUrl;
};