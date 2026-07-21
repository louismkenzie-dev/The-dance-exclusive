import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStaffMember } from "@/hooks/useStaffMember";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FadeRise, Stagger } from "@/components/motion";
import { MapPin, Clock } from "lucide-react";

const MyClasses = () => {
  const { staff } = useStaffMember();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!staff?.id) return;
    void load();
  }, [staff?.id]);

  const load = async () => {
    if (!staff) return;
    const todayStr = new Date().toISOString().split("T")[0];

    const { data: explicit } = await supabase
      .from("session_instructors")
      .select(`
        class_sessions!inner (
          id, session_date, start_time, end_time, class_id, status,
          classes:class_id ( name, class_type, dance_style, venues:venue_id ( name, city ) )
        )
      `)
      .eq("staff_id", staff.id);

    const { data: classAssignments } = await supabase
      .from("class_instructors")
      .select("class_id")
      .eq("staff_id", staff.id);

    let defaults: any[] = [];
    const classIds = (classAssignments ?? []).map((c) => c.class_id);
    if (classIds.length > 0) {
      const { data } = await supabase
        .from("class_sessions")
        .select(`
          id, session_date, start_time, end_time, class_id, status,
          classes:class_id ( name, class_type, dance_style, venues:venue_id ( name, city ) )
        `)
        .in("class_id", classIds)
        .gte("session_date", todayStr);

      const { data: overrides } = await supabase
        .from("session_instructors")
        .select("session_id")
        .in("session_id", (data ?? []).map((s) => s.id));
      const overrideIds = new Set((overrides ?? []).map((o: any) => o.session_id));
      defaults = (data ?? []).filter((s) => !overrideIds.has(s.id));
    }

    const all = [
      ...(explicit ?? []).map((r: any) => r.class_sessions),
      ...defaults,
    ]
      .filter((s) => s.session_date >= todayStr)
      .sort((a, b) =>
        a.session_date === b.session_date
          ? a.start_time.localeCompare(b.start_time)
          : a.session_date.localeCompare(b.session_date),
      );

    setSessions(all);
    setLoading(false);
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <FadeRise className="mb-8">
        <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">My classes</h1>
        <p className="text-muted-foreground mt-1">All upcoming sessions you're teaching</p>
      </FadeRise>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : sessions.length === 0 ? (
        <FadeRise>
          <Card><CardContent className="py-12 text-center text-muted-foreground">No upcoming classes assigned.</CardContent></Card>
        </FadeRise>
      ) : (
        <Stagger className="space-y-4">
          {sessions.map((s) => {
            const isAdult = s.classes?.class_type === "adult";
            return (
              <Card key={s.id} className="transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft-lg">
                <CardContent className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                  <div
                    className={`flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl ${
                      isAdult ? "bg-accent/8 text-accent" : "bg-primary/8 text-primary"
                    }`}
                  >
                    <span className="text-[11px] font-semibold">
                      {new Date(s.session_date).toLocaleDateString("en-GB", { weekday: "short" })}
                    </span>
                    <span className="text-2xl font-display font-bold tabular-nums leading-tight">
                      {new Date(s.session_date).toLocaleDateString("en-GB", { day: "numeric" })}
                    </span>
                    <span className="text-[11px] font-medium">
                      {new Date(s.session_date).toLocaleDateString("en-GB", { month: "short" })}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-display font-bold">{s.classes?.name}</h3>
                      <Badge variant={isAdult ? "accent" : "default"}>
                        {isAdult ? "Adult" : "Children"}
                      </Badge>
                      {s.classes?.dance_style && <Badge variant="secondary">{s.classes.dance_style}</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-3">
                      <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}</span>
                      {s.classes?.venues?.name && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {s.classes.venues.name}{s.classes.venues.city ? `, ${s.classes.venues.city}` : ""}</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </Stagger>
      )}
    </div>
  );
};

export default MyClasses;
