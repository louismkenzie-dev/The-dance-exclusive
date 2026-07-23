import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Crown, Loader2, MapPin, UserPlus, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

interface AssignedStaff {
  id: string; // class_instructors row id
  instructor_role: string;
  staff: { id: string; full_name: string; email: string | null; user_id: string | null } | null;
}

interface TimetableClass {
  id: string;
  name: string;
  class_type: string;
  dance_style: string | null;
  day_of_week: string;
  start_time: string;
  end_time: string;
  capacity: number;
  publicly_visible: boolean;
  venues: { name: string } | null;
  class_instructors: AssignedStaff[];
}

interface StaffOption {
  id: string;
  full_name: string;
  role: string;
  email: string | null;
  user_id: string | null;
}

/**
 * Staffing timetable: the admin's enriched view of the weekly schedule. Every
 * class shows who's teaching it — unstaffed classes are flagged — and staff
 * can be assigned in place. Assignment emails the teacher their class details
 * with a link to the staff-portal register when they have an account.
 */
const AdminTimetable = () => {
  const { toast } = useToast();
  const [classes, setClasses] = useState<TimetableClass[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignTarget, setAssignTarget] = useState<TimetableClass | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<"main" | "assistant">("main");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const [{ data: cls }, { data: staff }] = await Promise.all([
      supabase
        .from("classes")
        .select(
          "id, name, class_type, dance_style, day_of_week, start_time, end_time, capacity, publicly_visible, venues(name), class_instructors(id, instructor_role, staff(id, full_name, email, user_id))",
        )
        .eq("is_active", true)
        .order("start_time"),
      supabase
        .from("staff")
        .select("id, full_name, role, email, user_id")
        .eq("is_active", true)
        .order("full_name"),
    ]);
    if (cls) setClasses(cls as unknown as TimetableClass[]);
    if (staff) setStaffList(staff as StaffOption[]);
    setLoading(false);
  }, []);
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const unstaffedCount = useMemo(
    () => classes.filter((c) => (c.class_instructors ?? []).length === 0).length,
    [classes],
  );

  const openAssign = (cls: TimetableClass) => {
    setAssignTarget(cls);
    setSelectedStaffId(null);
    // First assignment defaults to Main; later ones to Assistant.
    setSelectedRole((cls.class_instructors ?? []).some((a) => a.instructor_role === "main") ? "assistant" : "main");
  };

  const confirmAssign = async () => {
    if (!assignTarget || !selectedStaffId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("assign-staff", {
        body: {
          action: "assign",
          classId: assignTarget.id,
          staffId: selectedStaffId,
          instructorRole: selectedRole,
        },
      });
      if (error || data?.error) {
        toast({ title: "Could not assign", description: data?.error || error?.message, variant: "destructive" });
      } else {
        const person = staffList.find((s) => s.id === selectedStaffId);
        toast({
          title: `${person?.full_name ?? "Staff member"} assigned`,
          description: data?.emailSent
            ? "They've been emailed their class details and register link."
            : data?.alreadyAssigned
              ? "Role updated — no email sent for a role change."
              : "Assigned — no email address on file, so no email was sent.",
        });
        setAssignTarget(null);
        fetchAll();
      }
    } catch (e: any) {
      toast({ title: "Could not assign", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const unassign = async (cls: TimetableClass, a: AssignedStaff) => {
    if (!a.staff) return;
    setRemoving(a.id);
    try {
      const { data, error } = await supabase.functions.invoke("assign-staff", {
        body: { action: "unassign", classId: cls.id, staffId: a.staff.id },
      });
      if (error || data?.error) {
        toast({ title: "Could not remove", description: data?.error || error?.message, variant: "destructive" });
      } else {
        toast({ title: `${a.staff.full_name} removed from ${cls.name}` });
        fetchAll();
      }
    } finally {
      setRemoving(null);
    }
  };

  const classesByDay = DAYS.map((day) => ({
    day,
    classes: classes.filter((c) => c.day_of_week === day),
  }));

  const assignedIds = new Set(
    (assignTarget?.class_instructors ?? []).map((a) => a.staff?.id).filter(Boolean) as string[],
  );
  const candidates = staffList.filter((s) => !assignedIds.has(s.id));

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold">Timetable &amp; Staffing</h1>
          <p className="text-muted-foreground mt-1">
            Weekly schedule with teaching assignments — click Assign to put a staff member on a class.
          </p>
        </div>
        {!loading && (
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              unstaffedCount > 0
                ? "border-destructive/50 text-destructive"
                : "border-emerald-500/50 text-emerald-600 dark:text-emerald-400",
            )}
          >
            {unstaffedCount > 0 ? `${unstaffedCount} class${unstaffedCount === 1 ? "" : "es"} without staff` : "All classes staffed"}
          </Badge>
        )}
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
                    {dayClasses.map((c) => {
                      const assigned = c.class_instructors ?? [];
                      const unstaffed = assigned.length === 0;
                      return (
                        <div
                          key={c.id}
                          className={cn(
                            "p-3 rounded-lg bg-muted/50 space-y-2",
                            unstaffed && "border border-destructive/40",
                          )}
                        >
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="text-sm font-mono font-medium text-primary">
                                {c.start_time?.slice(0, 5)} – {c.end_time?.slice(0, 5)}
                              </div>
                              <span className="font-medium">{c.name}</span>
                              {c.dance_style && (
                                <span className="text-muted-foreground text-sm">({c.dance_style})</span>
                              )}
                              <Badge variant={c.class_type === "children" ? "default" : "secondary"}>
                                {c.class_type === "children" ? "Children" : "Adult"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              {c.venues && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5" /> {c.venues.name}
                                </span>
                              )}
                              <span>Cap: {c.capacity}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {unstaffed ? (
                              <Badge variant="outline" className="border-destructive/50 text-destructive gap-1">
                                <AlertTriangle className="w-3 h-3" /> No staff assigned
                              </Badge>
                            ) : (
                              assigned.map((a) =>
                                a.staff ? (
                                  <Badge key={a.id} variant="secondary" className="gap-1.5 pr-1">
                                    {a.instructor_role === "main" ? (
                                      <Crown className="w-3 h-3 text-amber-500" />
                                    ) : (
                                      <Users className="w-3 h-3" />
                                    )}
                                    {a.staff.full_name}
                                    <span className="text-[10px] text-muted-foreground uppercase">
                                      {a.instructor_role === "main" ? "Main" : "Asst"}
                                    </span>
                                    <button
                                      type="button"
                                      aria-label={`Remove ${a.staff.full_name} from ${c.name}`}
                                      className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive"
                                      onClick={() => unassign(c, a)}
                                      disabled={removing === a.id}
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </Badge>
                                ) : null,
                              )
                            )}
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => openAssign(c)}>
                              <UserPlus className="w-3.5 h-3.5 mr-1" /> Assign
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!assignTarget} onOpenChange={(o) => { if (!o && !saving) setAssignTarget(null); }}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" /> Assign staff
            </DialogTitle>
            <DialogDescription>
              Choose who teaches <strong>{assignTarget?.name}</strong>
              {assignTarget?.day_of_week && (
                <> ({assignTarget.day_of_week.charAt(0).toUpperCase() + assignTarget.day_of_week.slice(1)}s{" "}
                {assignTarget.start_time?.slice(0, 5)})</>
              )}
              . They&#39;ll be emailed the class details and their register link.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as "main" | "assistant")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main">Main instructor</SelectItem>
                <SelectItem value="assistant">Assistant</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="flex-1 min-h-0 max-h-72 -mx-1 px-1">
            {candidates.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Every active staff member is already on this class.
              </p>
            ) : (
              <div className="space-y-1.5 py-1">
                {candidates.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedStaffId(s.id)}
                    className={cn(
                      "w-full text-left rounded-lg border p-2.5 transition-colors flex items-center justify-between gap-2",
                      selectedStaffId === s.id
                        ? "border-primary bg-primary/10 ring-1 ring-primary"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    <div>
                      <p className="text-sm font-semibold">{s.full_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{s.role?.replace(/_/g, " ")}</p>
                    </div>
                    {!s.user_id && (
                      <Badge variant="outline" className="text-[10px]">No portal account</Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTarget(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={confirmAssign} disabled={!selectedStaffId || saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Assign &amp; notify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTimetable;
