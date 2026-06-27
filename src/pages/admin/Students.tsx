import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { differenceInYears, format } from "date-fns";
import { Search, Users, Pencil, User as UserIcon, Eye, Phone, Mail } from "lucide-react";
import StudentProfileDrawer from "@/components/staff/StudentProfileDrawer";
import { ChildFormDialog } from "@/components/portal/ChildFormDialog";
import CustomerEditDialog from "@/components/admin/CustomerEditDialog";

const AdminStudents = () => {
  const [search, setSearch] = useState("");
  const [profileStudentId, setProfileStudentId] = useState<string | null>(null);
  const [editingChild, setEditingChild] = useState<any | null>(null);
  const [editingParent, setEditingParent] = useState<any | null>(null);

  const { data: students = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-students-directory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .order("first_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: parents = [], refetch: refetchParents } = useQuery({
    queryKey: ["admin-students-parents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, email, phone, secondary_phone, address_line1, address_line2, city, county, postcode");
      if (error) throw error;
      return data ?? [];
    },
  });

  const parentByUserId = new Map(parents.map((p: any) => [p.user_id, p]));

  const q = search.trim().toLowerCase();
  const filtered = students.filter((s: any) => {
    if (!q) return true;
    const parent = parentByUserId.get(s.parent_id);
    return (
      s.first_name?.toLowerCase().includes(q) ||
      s.last_name?.toLowerCase().includes(q) ||
      s.preferred_name?.toLowerCase().includes(q) ||
      parent?.full_name?.toLowerCase().includes(q) ||
      parent?.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight flex items-center gap-2">
            <UserIcon className="w-7 h-7" /> STUDENT DIRECTORY
          </h1>
          <p className="text-muted-foreground mt-1">{students.length} enrolled student{students.length === 1 ? "" : "s"}</p>
        </div>
      </div>

      <div className="relative max-w-sm mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by student or parent…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No students found.</CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((s: any) => {
            const parent = parentByUserId.get(s.parent_id);
            const age = s.date_of_birth ? differenceInYears(new Date(), new Date(s.date_of_birth)) : null;
            const hasUrgent = s.has_epipen || s.has_inhaler;
            return (
              <Card key={s.id} className="animate-fade-in hover:border-primary/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {s.profile_photo ? (
                      <img
                        src={s.profile_photo}
                        alt={`${s.first_name} ${s.last_name}`}
                        className="w-14 h-14 rounded-full object-cover border border-border flex-shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-base font-bold flex-shrink-0">
                        {s.first_name?.[0]}{s.last_name?.[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold leading-tight truncate">
                            {s.first_name} {s.last_name}
                            {s.preferred_name && (
                              <span className="text-muted-foreground font-normal"> "{s.preferred_name}"</span>
                            )}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {age != null && <>Age {age} · </>}
                            {s.date_of_birth && format(new Date(s.date_of_birth), "d MMM yyyy")}
                            {s.gender && <> · {s.gender}</>}
                          </p>
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {s.has_epipen && <Badge variant="destructive" className="text-[10px]">EpiPen</Badge>}
                        {s.has_inhaler && <Badge variant="destructive" className="text-[10px]">Inhaler</Badge>}
                        {s.allergies_list?.length > 0 && <Badge variant="destructive" className="text-[10px]">Allergies ({s.allergies_list.length})</Badge>}
                        {s.medical_conditions_list?.length > 0 && <Badge variant="outline" className="text-[10px]">Medical</Badge>}
                        {s.has_send && <Badge className="text-[10px] bg-amber-500 hover:bg-amber-600">SEND</Badge>}
                        {s.ehcp_in_place && <Badge className="text-[10px] bg-amber-500 hover:bg-amber-600">EHCP</Badge>}
                        {s.one_to_one_required && <Badge className="text-[10px] bg-amber-500 hover:bg-amber-600">1:1</Badge>}
                        {s.ability_level && <Badge variant="secondary" className="text-[10px] capitalize">{s.ability_level}</Badge>}
                        {!s.photo_consent && <Badge variant="outline" className="text-[10px]">No photo</Badge>}
                      </div>

                      {/* Parent */}
                      {parent && (
                        <div className="mt-3 pt-3 border-t border-border/50 text-xs space-y-0.5">
                          <p className="font-medium flex items-center gap-1.5">
                            <Users className="w-3 h-3 text-muted-foreground" /> {parent.full_name}
                          </p>
                          {parent.phone && (
                            <p className="text-muted-foreground flex items-center gap-1.5">
                              <Phone className="w-3 h-3" /> {parent.phone}
                            </p>
                          )}
                          {parent.email && (
                            <p className="text-muted-foreground flex items-center gap-1.5 truncate">
                              <Mail className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{parent.email}</span>
                            </p>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-1.5 mt-3 flex-wrap">
                        <Button size="sm" variant="outline" className="gap-1 h-8" onClick={() => setProfileStudentId(s.id)}>
                          <Eye className="w-3.5 h-3.5" /> View
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1 h-8" onClick={() => setEditingChild(s)}>
                          <Pencil className="w-3.5 h-3.5" /> Edit child
                        </Button>
                        {parent && (
                          <Button size="sm" variant="outline" className="gap-1 h-8" onClick={() => setEditingParent(parent)}>
                            <Pencil className="w-3.5 h-3.5" /> Edit parent
                          </Button>
                        )}
                      </div>
                    </div>
                    {hasUrgent && (
                      <div className="absolute" />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <StudentProfileDrawer
        open={!!profileStudentId}
        onOpenChange={(o) => !o && setProfileStudentId(null)}
        studentId={profileStudentId}
      />

      <ChildFormDialog
        open={!!editingChild}
        onOpenChange={(o) => !o && setEditingChild(null)}
        editing={editingChild}
        onSaved={() => { setEditingChild(null); void refetch(); }}
      />

      <CustomerEditDialog
        open={!!editingParent}
        onOpenChange={(o) => !o && setEditingParent(null)}
        profile={editingParent}
        onSaved={() => { setEditingParent(null); void refetchParents(); }}
      />
    </div>
  );
};

export default AdminStudents;
