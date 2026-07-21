import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Legacy deep-link route (/book/:classId). It used to insert unpaid
 * pending_payment bookings directly, bypassing payment, the duplicate-booking
 * guard and attendee-profile requirements. Nothing in the app links here any
 * more — redirect old links into the real booking flow instead.
 */
const BookClass = () => {
  const { classId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const redirect = async () => {
      let type: string = "children";
      if (classId) {
        const { data } = await supabase
          .from("classes")
          .select("class_type")
          .eq("id", classId)
          .maybeSingle();
        if (data?.class_type) type = data.class_type;
      }
      if (!cancelled) navigate(`/classes/${type}`, { replace: true });
    };
    void redirect();
    return () => {
      cancelled = true;
    };
  }, [classId, navigate]);

  return (
    <div className="container flex min-h-[50vh] items-center justify-center py-12">
      <p className="text-center text-muted-foreground">Taking you to the class browser…</p>
    </div>
  );
};

export default BookClass;
