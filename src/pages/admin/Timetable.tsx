import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FadeRise, Stagger } from "@/components/motion";
import { CalendarDays } from "lucide-react";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

interface TimetableClass {
  id: string;
  name: string;
  class_type: string;
  dance_style: string | null;
  day_of_week: string;
  start_time: string;
  end_time: string;
  capacity: number;
  venues: { name: string } | null;
  staff: { full_name: string } | null;
}

const AdminTimetable = () => {
  const [classes, setClasses] = useState<TimetableClass[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("classes")
        .select("id, name, class_type, dance_style, day_of_week, start_time, end_time, capacity, venues(name), staff(full_name)")
        .eq("is_active", true)
        .order("start_time");
      if (data) setClasses(data as any);
      setLoading(false);
    };
    fetch();
  }, []);

  const classesByDay = DAYS.map((day) => ({
    day,
    classes: classes.filter((c) => c.day_of_week === day),
  }));

  return (
    <div className="p-4 md:p-8">
      <FadeRise className="mb-8">
        <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Timetable</h1>
        <p className="text-muted-foreground mt-1">Weekly class schedule</p>
      </FadeRise>

      {loading ? (
        <div className="text-muted-foreground">Loading timetable...</div>
      ) : (
        <Stagger className="grid gap-4">
          {classesByDay.map(({ day, classes: dayClasses }) => (
            <Card key={day}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg capitalize">{day}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {dayClasses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No classes scheduled</p>
                ) : (
                  <div className="space-y-2.5">
                    {dayClasses.map((c) => (
                      <div key={c.id} className="flex flex-col gap-2 rounded-2xl bg-secondary/50 p-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
                          <div className="text-sm font-display font-semibold tabular-nums text-primary whitespace-nowrap">
                            {c.start_time?.slice(0, 5)} – {c.end_time?.slice(0, 5)}
                          </div>
                          <div className="min-w-0">
                            <span className="font-medium break-words">{c.name}</span>
                            {c.dance_style && <span className="text-muted-foreground ml-2 text-sm">({c.dance_style})</span>}
                          </div>
                          <Badge variant={c.class_type === "children" ? "default" : "accent"}>
                            {c.class_type === "children" ? "Children" : "Adult"}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground min-w-0">
                          {c.venues && <span className="truncate">{(c.venues as any).name}</span>}
                          {c.staff && <span className="truncate">{(c.staff as any).full_name}</span>}
                          <span className="whitespace-nowrap">Cap: {c.capacity}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </Stagger>
      )}
    </div>
  );
};

export default AdminTimetable;
