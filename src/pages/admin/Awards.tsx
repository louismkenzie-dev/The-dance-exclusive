import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { format, parseISO } from "date-fns";
import { Award, History, Plus, Search, Sparkles, Trash2, Trophy } from "lucide-react";
import {
  AWARD_TYPES,
  awardTypeLabel,
  previousWinsFor,
  type StudentAward,
} from "@/lib/awards";

interface ClassOption { id: string; name: string; is_active: boolean }
interface TermOption { id: string; name: string; academic_year: string }
interface StudentOption { id: string; first_name: string; last_name: string }

const AdminAwards = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [classId, setClassId] = useState("");
  const [termLabel, setTermLabel] = useState("");
  const [studentId, setStudentId] = useState("");
  const [awardType, setAwardType] = useState<string>("dancer_of_term");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterClass, setFilterClass] = useState<string>("all");

  const { data: classes = [] } = useQuery({
    queryKey: ["awards-classes"],
    queryFn: async (): Promise<ClassOption[]> => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, is_active")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: terms = [] } = useQuery({
    queryKey: ["awards-terms"],
    queryFn: async (): Promise<TermOption[]> => {
      const { data, error } = await supabase
        .from("school_terms")
        .select("id, name, academic_year")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: awards = [], isLoading } = useQuery({
    queryKey: ["awards-list"],
    queryFn: async (): Promise<StudentAward[]> => {
      const { data, error } = await supabase
        .from("student_awards")
        .select("id, student_id, class_id, class_name, term_label, award_type, notes, awarded_on, students:student_id ( first_name, last_name, preferred_name )")
        .order("awarded_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as StudentAward[];
    },
  });

  // The register for the chosen class: who can actually be picked.
  const { data: classStudents = [], isLoading: loadingStudents } = useQuery({
    queryKey: ["awards-class-students", classId],
    enabled: !!classId,
    queryFn: async (): Promise<StudentOption[]> => {
      const { data, error } = await supabase
        .from("bookings")
        .select("student_id, students:student_id ( id, first_name, last_name )")
        .eq("class_id", classId)
        .eq("status", "confirmed");
      if (error) throw error;
      const byId = new Map<string, StudentOption>();
      for (const row of data ?? []) {
        const s = row.students as StudentOption | null;
        if (s?.id) byId.set(s.id, s);
      }
      return [...byId.values()].sort((a, b) =>
        `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));
    },
  });

  const termOptions = useMemo(() => {
    const fromTerms = terms.map((t) => `${t.name} ${t.academic_year}`.trim());
    // Terms already used on an award stay pickable even after a term row is
    // tidied away, so the history keeps one consistent set of labels.
    const fromAwards = awards.map((a) => a.term_label);
    return [...new Set([...fromTerms, ...fromAwards])].filter(Boolean);
  }, [terms, awards]);

  const resetForm = () => {
    setClassId("");
    setTermLabel("");
    setStudentId("");
    setAwardType("dancer_of_term");
    setNotes("");
  };

  // The whole point of the section: has this dancer had this before?
  const priorWins = useMemo(
    () => (studentId ? previousWinsFor(awards, studentId) : []),
    [awards, studentId],
  );

  const save = async () => {
    if (!studentId || !termLabel.trim()) {
      toast({ title: "Pick a dancer and a term", variant: "destructive" });
      return;
    }
    setSaving(true);
    const chosenClass = classes.find((c) => c.id === classId);
    const chosenTerm = terms.find((t) => `${t.name} ${t.academic_year}`.trim() === termLabel.trim());
    const { error } = await supabase
      .from("student_awards")
      .upsert(
        {
          student_id: studentId,
          class_id: classId || null,
          class_name: chosenClass?.name ?? null,
          term_id: chosenTerm?.id ?? null,
          term_label: termLabel.trim(),
          award_type: awardType,
          notes: notes.trim() || null,
          awarded_by: user?.id ?? null,
        },
        { onConflict: "award_type,term_label,class_id" },
      );
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save the award", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Award saved" });
    void queryClient.invalidateQueries({ queryKey: ["awards-list"] });
    setDialogOpen(false);
    resetForm();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("student_awards").delete().eq("id", id);
    if (error) {
      toast({ title: "Couldn't remove the award", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Award removed" });
    void queryClient.invalidateQueries({ queryKey: ["awards-list"] });
  };

  const nameOf = (a: StudentAward) =>
    a.students ? `${a.students.first_name} ${a.students.last_name}` : "Unknown dancer";

  const visible = awards.filter((a) => {
    if (filterType !== "all" && a.award_type !== filterType) return false;
    if (filterClass !== "all" && a.class_id !== filterClass) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      nameOf(a).toLowerCase().includes(q) ||
      (a.class_name ?? "").toLowerCase().includes(q) ||
      a.term_label.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-400" /> Awards
          </h1>
          <p className="text-sm text-muted-foreground">
            Dancer of the Term and Most Improved, kept in one place so awards can be shared out fairly.
          </p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="gap-1.5">
          <Plus className="w-4 h-4" /> Record an award
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <Label className="text-xs">Search</Label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Dancer, class or term…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Award</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All awards</SelectItem>
                {AWARD_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{awardTypeLabel(t)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Class</Label>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 md:p-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading awards…</p>
          ) : visible.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Award className="w-10 h-10 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {awards.length === 0
                  ? "No awards recorded yet — record your first one to start the history."
                  : "No awards match those filters."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dancer</TableHead>
                    <TableHead>Award</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead className="w-[120px]">Date</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{nameOf(a)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={a.award_type === "dancer_of_term"
                            ? "border-amber-500/40 text-amber-500"
                            : "border-sky-500/40 text-sky-500"}
                        >
                          {awardTypeLabel(a.award_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.class_name ?? "—"}</TableCell>
                      <TableCell className="text-sm">{a.term_label}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(parseISO(a.awarded_on), "d MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${awardTypeLabel(a.award_type)} for ${nameOf(a)}`}
                          onClick={() => void remove(a.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-dialog overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record an award</DialogTitle>
            <DialogDescription>
              Pick the class, the term and the dancer. Anything they&rsquo;ve won before shows up as you choose.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Class</Label>
              <Select value={classId} onValueChange={(v) => { setClassId(v); setStudentId(""); }}>
                <SelectTrigger><SelectValue placeholder="Choose a class" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.is_active === false ? " (inactive)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Term</Label>
              <Select value={termLabel} onValueChange={setTermLabel}>
                <SelectTrigger><SelectValue placeholder="Choose a term" /></SelectTrigger>
                <SelectContent>
                  {termOptions.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {termOptions.length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  No terms set up yet — add them under Settings &rsaquo; Term dates.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Dancer</Label>
              <Select value={studentId} onValueChange={setStudentId} disabled={!classId}>
                <SelectTrigger>
                  <SelectValue placeholder={classId ? "Choose from the register" : "Pick a class first"} />
                </SelectTrigger>
                <SelectContent>
                  {classStudents.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.first_name} {s.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {classId && !loadingStudents && classStudents.length === 0 && (
                <p className="text-[11px] text-muted-foreground">Nobody is booked into that class yet.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Award</Label>
              <Select value={awardType} onValueChange={setAwardType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AWARD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{awardTypeLabel(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {studentId && (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1.5">
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" /> Previously awarded
                </p>
                {priorWins.length === 0 ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                    Nothing yet — this would be their first.
                  </p>
                ) : (
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {priorWins.map((w) => (
                      <li key={w.id}>
                        <span className="text-foreground font-medium">{awardTypeLabel(w.award_type)}</span>
                        {" · "}{w.class_name ?? "class not recorded"}{" · "}{w.term_label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Notes (optional)</Label>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Why they were chosen — helpful when you look back next year."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void save()} disabled={saving || !studentId || !termLabel}>
              {saving ? "Saving…" : "Save award"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAwards;
