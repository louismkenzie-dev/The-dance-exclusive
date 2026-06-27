import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold">Timetable</h1>
        <p className="text-muted-foreground mt-1">Weekly class schedule</p>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading timetable...</div>
      ) : (
        <div className="grid gap-6">
          {classesByDay.map(({ day, classes: dayClasses }) => (
            <Card key={day} className="animate-fade-in">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg capitalize">{day}</CardTitle>
              </CardHeader>
              <CardContent>
                {dayClasses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No classes scheduled</p>
                ) : (
                  <div className="space-y-3">
                    {dayClasses.map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className="text-sm font-mono font-medium text-primary">
                            {c.start_time?.slice(0, 5)} – {c.end_time?.slice(0, 5)}
                          </div>
                          <div>
                            <span className="font-medium">{c.name}</span>
                            {c.dance_style && <span className="text-muted-foreground ml-2 text-sm">({c.dance_style})</span>}
                          </div>
                          <Badge variant={c.class_type === "children" ? "default" : "secondary"}>
                            {c.class_type === "children" ? "Children" : "Adult"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {c.venues && <span>{(c.venues as any).name}</span>}
                          {c.staff && <span>{(c.staff as any).full_name}</span>}
                          <span>Cap: {c.capacity}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminTimetable;
