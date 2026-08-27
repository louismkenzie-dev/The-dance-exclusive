import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { classBrowserPath } from "@/lib/classLinks";

/**
 * /book/:classId — the shareable link for a single class, so the studio can
 * send a family straight to it. It resolves which browser tab the class
 * lives on and opens that class there.
 *
 * It began as a legacy route that inserted unpaid bookings directly,
 * bypassing payment, the duplicate-booking guard and attendee-profile
 * requirements; old links now land in the real booking flow.
 */
const BookClass = () => {
  const { classId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const redirect = async () => {
      let target = "/classes/children";
      if (classId) {
        const { data } = await supabase
          .from("classes")
          .select("id, class_type")
          .eq("id", classId)
          .maybeSingle();
        // An unknown id lands on the children's browser rather than a dead
        // end — the link may be old, or the class since removed.
        if (data) {
          target = classBrowserPath(data.id, data.class_type as "children" | "adult");
        }
      }
      if (!cancelled) navigate(target, { replace: true });
    };
    void redirect();
    return () => {
      cancelled = true;
    };
  }, [classId, navigate]);

  return (
    <div className="container py-12 text-center text-muted-foreground">
      Taking you to the class browser…
    </div>
  );
};

export default BookClass;
