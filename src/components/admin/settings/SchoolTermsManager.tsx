import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Calendar, Loader2, Plus, Trash2, Edit2, GraduationCap, Palmtree, Flag, ExternalLink
} from "lucide-react";
import { format, parseISO, differenceInWeeks } from "date-fns";

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth();
const defaultAcademicYear = currentMonth >= 6
  ? `${currentYear}-${currentYear + 1}`
  : `${currentYear - 1}-${currentYear}`;

const ACADEMIC_YEARS = Array.from({ length: 5 }, (_, i) => {
  const y = currentYear - 1 + i;
  return `${y}-${y + 1}`;
});

const TERM_TYPES = [
  { value: "autumn", label: "Autumn", color: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  { value: "spring", label: "Spring", color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  { value: "summer", label: "Summer", color: "bg-sky-500/15 text-sky-500 border-sky-500/30" },
];

const HOLIDAY_TYPES = [
  { value: "half_term", label: "Half Term" },
  { value: "christmas", label: "Christmas" },
  { value: "easter", label: "Easter" },
  { value: "summer", label: "Summer Holiday" },
  { value: "bank_holiday", label: "Bank Holiday" },
];

interface TermRow {
  id: string;
  name: string;
  term_type: string;
  academic_year: string;
  start_date: string;
  end_date: string;
}

interface HolidayRow {
  id: string;
  name: string;
  holiday_type: string;
  academic_year: string;
  start_date: string;
  end_date: string;
  source: string;
  last_synced_at: string | null;
}

export const SchoolTermsManager = () => {
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useState(defaultAcademicYear);

  // Edit dialog state
  const [editDialog, setEditDialog] = useState<"term" | "holiday" | null>(null);
  const [editItem, setEditItem] = useState<any>(null);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");

  const { data: terms = [], isLoading: termsLoading } = useQuery({
    queryKey: ["school-terms", selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_terms")
        .select("*")
        .eq("academic_year", selectedYear)
        .order("start_date");
      if (error) throw error;
      return data as TermRow[];
    },
  });

  const { data: holidays = [], isLoading: holidaysLoading } = useQuery({
    queryKey: ["school-holidays", selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_holidays")
        .select("*")
        .eq("academic_year", selectedYear)
        .order("start_date");
      if (error) throw error;
      return data as HolidayRow[];
    },
  });

  const schoolHolidays = holidays.filter(h => h.holiday_type !== "bank_holiday");
  const bankHolidays = holidays.filter(h => h.holiday_type === "bank_holiday");

  const openAddTerm = () => {
    setEditItem(null);
    setFormName("");
    setFormType("autumn");
    setFormStart("");
    setFormEnd("");
    setEditDialog("term");
  };

  const openEditTerm = (t: TermRow) => {
    setEditItem(t);
    setFormName(t.name);
    setFormType(t.term_type);
    setFormStart(t.start_date);
    setFormEnd(t.end_date);
    setEditDialog("term");
  };

  const openAddHoliday = () => {
    setEditItem(null);
    setFormName("");
    setFormType("half_term");
    setFormStart("");
    setFormEnd("");
    setEditDialog("holiday");
  };

  const openEditHoliday = (h: HolidayRow) => {
    setEditItem(h);
    setFormName(h.name);
    setFormType(h.holiday_type);
    setFormStart(h.start_date);
    setFormEnd(h.end_date);
    setEditDialog("holiday");
  };

  const saveTerm = async () => {
    const payload = {
      name: formName,
      term_type: formType,
      academic_year: selectedYear,
      start_date: formStart,
      end_date: formEnd,
    };
    if (editItem?.id) {
      const { error, data } = await supabase.from("school_terms").update(payload).eq("id", editItem.id).select();
      if (error) { toast.error(error.message); return; }
      if (!data || data.length === 0) { toast.error("Update failed — no rows were changed"); return; }
    } else {
      const { error } = await supabase.from("school_terms").insert(payload);
      if (error) { toast.error(error.message); return; }
    }
    toast.success(editItem ? "Term updated" : "Term added");
    setEditDialog(null);
    await queryClient.invalidateQueries({ queryKey: ["school-terms", selectedYear] });
  };

  const saveHoliday = async () => {
    const payload = {
      name: formName,
      holiday_type: formType,
      academic_year: selectedYear,
      start_date: formStart,
      end_date: formEnd,
      source: "manual",
    };
    if (editItem?.id) {
      const { error, data } = await supabase.from("school_holidays").update(payload).eq("id", editItem.id).select();
      if (error) { toast.error(error.message); return; }
      if (!data || data.length === 0) { toast.error("Update failed — no rows were changed"); return; }
    } else {
      const { error } = await supabase.from("school_holidays").insert(payload);
      if (error) { toast.error(error.message); return; }
    }
    toast.success(editItem ? "Holiday updated" : "Holiday added");
    setEditDialog(null);
    await queryClient.invalidateQueries({ queryKey: ["school-holidays", selectedYear] });
  };

  const deleteTerm = async (id: string) => {
    const { error } = await supabase.from("school_terms").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Term deleted"); queryClient.invalidateQueries({ queryKey: ["school-terms", selectedYear] }); }
  };

  const deleteHoliday = async (id: string) => {
    const { error } = await supabase.from("school_holidays").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Holiday deleted"); queryClient.invalidateQueries({ queryKey: ["school-holidays", selectedYear] }); }
  };

  const getTermColor = (type: string) => TERM_TYPES.find(t => t.value === type)?.color || "";
  const getTermLabel = (type: string) => TERM_TYPES.find(t => t.value === type)?.label || type;

  const isLoading = termsLoading || holidaysLoading;

  return (
    <>
      {/* Academic Year Selector */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-5">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1">Academic Year</p>
          <p className="text-3xl font-display font-bold tracking-tight">{selectedYear}</p>
        </div>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACADEMIC_YEARS.map(y => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            School Terms, Holidays & Bank Holidays
          </CardTitle>
          <CardDescription>
            Manage school term dates, holidays, and bank holidays. Classes and holiday camps will not run during bank holidays.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Essex CC reference link */}
          <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Essex County Council term dates</p>
              <p className="text-xs text-muted-foreground">
                Reference the official term dates and school holidays for {selectedYear}
              </p>
            </div>
            <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <a
                href={`https://www.essex.gov.uk/schools-and-learning/schools/essex-school-terms-and-holidays/academic-year-${selectedYear}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Go to Essex term dates
              </a>
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Terms Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Term Dates
                  </h3>
                  <Button variant="outline" size="sm" onClick={openAddTerm}>
                    <Plus className="h-3 w-3 mr-1" /> Add Term
                  </Button>
                </div>
                {terms.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No terms configured. Import from Essex CC or add manually.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {terms.map(t => {
                      const weeks = differenceInWeeks(parseISO(t.end_date), parseISO(t.start_date));
                      return (
                        <div key={t.id} className="flex items-center justify-between rounded-lg border border-border p-3 group">
                          <div className="flex items-center gap-3">
                            <Badge className={getTermColor(t.term_type)}>
                              {getTermLabel(t.term_type)}
                            </Badge>
                            <div>
                              <span className="text-sm font-medium">{t.name}</span>
                              <p className="text-xs text-muted-foreground">
                                {format(parseISO(t.start_date), "d MMM yyyy")} – {format(parseISO(t.end_date), "d MMM yyyy")}
                                <span className="ml-2 text-muted-foreground/60">({weeks} weeks)</span>
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditTerm(t)}>
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteTerm(t.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <Separator />

              {/* School Holidays Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Palmtree className="h-4 w-4" />
                    School Holidays
                  </h3>
                  <Button variant="outline" size="sm" onClick={openAddHoliday}>
                    <Plus className="h-3 w-3 mr-1" /> Add Holiday
                  </Button>
                </div>
                {schoolHolidays.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No school holidays configured. Import from Essex CC or add manually.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {schoolHolidays.map(h => (
                      <div key={h.id} className="flex items-center justify-between rounded-lg border border-border p-3 group">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                            {HOLIDAY_TYPES.find(ht => ht.value === h.holiday_type)?.label || h.holiday_type}
                          </Badge>
                          <div>
                            <span className="text-sm font-medium">{h.name}</span>
                            <p className="text-xs text-muted-foreground">
                              {format(parseISO(h.start_date), "d MMM yyyy")} – {format(parseISO(h.end_date), "d MMM yyyy")}
                              {h.source === "essex_cc_ai" && (
                                <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">Essex CC</Badge>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditHoliday(h)}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteHoliday(h.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Bank Holidays Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Flag className="h-4 w-4" />
                    Bank Holidays
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">England &amp; Wales</Badge>
                  </h3>
                </div>
                {bankHolidays.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No bank holidays loaded. Click "Import Bank Holidays" above to fetch from GOV.UK.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {bankHolidays.map(h => (
                      <div key={h.id} className="flex items-center justify-between rounded-lg border border-border p-3 group">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                            Bank Holiday
                          </Badge>
                          <div>
                            <span className="text-sm font-medium">{h.name}</span>
                            <p className="text-xs text-muted-foreground">
                              {format(parseISO(h.start_date), "EEEE d MMMM yyyy")}
                              {h.source === "gov_uk" && (
                                <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">GOV.UK</Badge>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteHoliday(h.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editDialog} onOpenChange={() => setEditDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editItem ? "Edit" : "Add"} {editDialog === "term" ? "Term" : "Holiday"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder={editDialog === "term" ? "e.g. Autumn Term 1" : "e.g. October Half Term"} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(editDialog === "term" ? TERM_TYPES : HOLIDAY_TYPES).map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={formStart} onChange={e => setFormStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={formEnd} onChange={e => setFormEnd(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>Cancel</Button>
            <Button onClick={editDialog === "term" ? saveTerm : saveHoliday} disabled={!formName || !formStart || !formEnd}>
              {editItem ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
