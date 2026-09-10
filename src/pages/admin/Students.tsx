import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { differenceInYears, format } from "date-fns";
import { Users, Pencil, Eye, Phone, Mail } from "lucide-react";
import { AdminPage, EmptyState, FilterBar, PageHeader, RecordCard } from "@/components/admin/ui";
import StudentProfileDrawer from "@/components/staff/StudentProfileDrawer";
import PhotoAvatarDuo from "@/components/PhotoAvatarDuo";
import { initialsOf } from "@/lib/initials";
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
    <AdminPage>
      <PageHeader
        title="Students"
        count={students.length}
        subtitle={`${students.length} enrolled dancer${students.length === 1 ? "" : "s"} across every class`}
      />

      <FilterBar
        className="mt-5"
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search by dancer or parent…"
      />

      {isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          className="mt-6"
          title={q ? "No dancers match that search" : "No dancers yet"}
          body={q ? "Try a first name, a surname or the parent's email." : "Dancers appear here as soon as families add them."}
        />
      ) : (
        <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
          {filtered.map((s: any) => {
            const parent = parentByUserId.get(s.parent_id);
            const age = s.date_of_birth ? differenceInYears(new Date(), new Date(s.date_of_birth)) : null;
            const flags = [
              s.has_epipen && <Badge key="epipen" variant="destructive" className="text-[10px]">EpiPen</Badge>,
              s.has_inhaler && <Badge key="inhaler" variant="destructive" className="text-[10px]">Inhaler</Badge>,
              s.allergies_list?.length > 0 && <Badge key="allergies" variant="destructive" className="text-[10px]">Allergies ({s.allergies_list.length})</Badge>,
              s.medical_conditions_list?.length > 0 && <Badge key="medical" variant="outline" className="text-[10px]">Medical</Badge>,
              s.has_send && <Badge key="send" className="bg-amber-500 text-[10px] hover:bg-amber-600">SEND</Badge>,
              s.ehcp_in_place && <Badge key="ehcp" className="bg-amber-500 text-[10px] hover:bg-amber-600">EHCP</Badge>,
              s.one_to_one_required && <Badge key="oneToOne" className="bg-amber-500 text-[10px] hover:bg-amber-600">1:1</Badge>,
              s.ability_level && <Badge key="ability" variant="secondary" className="text-[10px] capitalize">{s.ability_level}</Badge>,
              !s.photo_consent && <Badge key="photo" variant="outline" className="text-[10px]">No photo</Badge>,
            ].filter(Boolean);
            return (
              <RecordCard
                key={s.id}
                className="animate-fade-in"
                leading={
                  /* Photo + Dance Exclusive avatar — tap either to see both large */
                  <PhotoAvatarDuo
                    photoUrl={s.profile_photo}
                    avatarUrl={s.avatar_url}
                    initials={initialsOf(s.first_name, s.last_name)}
                    size="md"
                    photoPrimary
                    expandable
                  />
                }
                title={
                  <>
                    {s.first_name} {s.last_name}
                    {s.preferred_name && (
                      <span className="font-normal text-muted-foreground"> "{s.preferred_name}"</span>
                    )}
                  </>
                }
                meta={
                  <span>
                    {age != null && <>Age {age} · </>}
                    {s.date_of_birth && format(new Date(s.date_of_birth), "d MMM yyyy")}
                    {s.gender && <> · {s.gender}</>}
                  </span>
                }
                actions={
                  <>
                    <Button size="sm" variant="soft" className="h-9 gap-1.5 rounded-full" onClick={() => setProfileStudentId(s.id)}>
                      <Eye className="h-3.5 w-3.5" /> View
                    </Button>
                    <Button size="sm" variant="soft" className="h-9 gap-1.5 rounded-full" onClick={() => setEditingChild(s)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit child
                    </Button>
                    {parent && (
                      <Button size="sm" variant="soft" className="h-9 gap-1.5 rounded-full" onClick={() => setEditingParent(parent)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit parent
                      </Button>
                    )}
                  </>
                }
              >
                <div>
                  {/* Flags the studio needs at a glance — medical first. A
                      dancer with nothing to flag gets no empty strip. */}
                  {flags.length > 0 && <div className="flex flex-wrap gap-1">{flags}</div>}

                  {/* Parent */}
                  {parent && (
                    <div className={`space-y-0.5 text-xs ${flags.length > 0 ? "mt-3 border-t border-border/50 pt-3" : ""}`}>
                      <p className="flex items-center gap-1.5 font-medium">
                        <Users className="h-3 w-3 text-muted-foreground" /> {parent.full_name}
                      </p>
                      {parent.phone && (
                        <p className="flex items-center gap-1.5 text-muted-foreground">
                          <Phone className="h-3 w-3" /> {parent.phone}
                        </p>
                      )}
                      {parent.email && (
                        <p className="flex items-center gap-1.5 truncate text-muted-foreground">
                          <Mail className="h-3 w-3 flex-shrink-0" /> <span className="truncate">{parent.email}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </RecordCard>
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
    </AdminPage>
  );
};

export default AdminStudents;
