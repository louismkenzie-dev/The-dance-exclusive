import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { differenceInYears, format } from "date-fns";
import { Search, Users, Pencil, User as UserIcon, Eye, Phone, Mail } from "lucide-react";
import { FadeRise, Stagger } from "@/components/motion";
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
      <FadeRise>
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/8 text-primary">
              <UserIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Student directory</h1>
              <p className="text-muted-foreground mt-1">{students.length} enrolled student{students.length === 1 ? "" : "s"}</p>
            </div>
          </div>
        </div>
      </FadeRise>

      <FadeRise delay={60}>
        <div className="relative max-w-sm mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by student or parent…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </FadeRise>

      {isLoading ? (
        <div className="text-muted-foreground text-sm animate-pulse">Loading…</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No students found.</CardContent></Card>
      ) : (
        <Stagger className="space-y-3" step={60}>
          {filtered.map((s: any) => {
            const parent = parentByUserId.get(s.parent_id);
            const age = s.date_of_birth ? differenceInYears(new Date(), new Date(s.date_of_birth)) : null;
            return (
              <Card key={s.id} className="transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg">
                <CardContent className="p-4 md:p-5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                    {s.profile_photo ? (
                      <img
                        src={s.profile_photo}
                        alt={`${s.first_name} ${s.last_name}`}
                        className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-primary/8 flex items-center justify-center text-sm font-display font-bold text-primary flex-shrink-0">
                        {s.first_name?.[0]}{s.last_name?.[0]}
                      </div>
                    )}

                    <div className="flex-1 min-w-0 basis-56">
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

                      {/* Badges */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {s.has_epipen && <Badge variant="destructive" className="text-[10px]">EpiPen</Badge>}
                        {s.has_inhaler && <Badge variant="destructive" className="text-[10px]">Inhaler</Badge>}
                        {s.allergies_list?.length > 0 && <Badge variant="destructive" className="text-[10px]">Allergies ({s.allergies_list.length})</Badge>}
                        {s.medical_conditions_list?.length > 0 && <Badge variant="outline" className="text-[10px]">Medical</Badge>}
                        {s.has_send && <Badge variant="warning" className="text-[10px]">SEND</Badge>}
                        {s.ehcp_in_place && <Badge variant="warning" className="text-[10px]">EHCP</Badge>}
                        {s.one_to_one_required && <Badge variant="warning" className="text-[10px]">1:1</Badge>}
                        {s.ability_level && <Badge variant="secondary" className="text-[10px] capitalize">{s.ability_level}</Badge>}
                        {!s.photo_consent && <Badge variant="outline" className="text-[10px]">No photo</Badge>}
                      </div>
                    </div>

                    {/* Parent */}
                    {parent && (
                      <div className="min-w-0 basis-52 text-xs space-y-0.5">
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
                    <div className="flex gap-1.5 flex-wrap ml-auto">
                      <Button size="sm" variant="secondary" className="gap-1" onClick={() => setProfileStudentId(s.id)}>
                        <Eye className="w-3.5 h-3.5" /> View
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditingChild(s)}>
                        <Pencil className="w-3.5 h-3.5" /> Edit child
                      </Button>
                      {parent && (
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditingParent(parent)}>
                          <Pencil className="w-3.5 h-3.5" /> Edit parent
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </Stagger>
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
