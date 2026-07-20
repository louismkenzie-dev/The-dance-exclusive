import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AlertTriangle, LogIn, LogOut, ShieldCheck, Users } from "lucide-react";

interface FamilyRow {
  id: string; // booking id
  student_id: string | null;
  students: {
    first_name: string;
    last_name: string;
    preferred_name?: string | null;
    profile_photo?: string | null;
    is_self?: boolean;
    has_epipen?: boolean;
    has_inhaler?: boolean;
    has_send?: boolean;
  } | null;
  attendance: {
    checked_in_at: string | null;
    checked_out_at: string | null;
    status: string;
  } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className: string;
  sessionTime: string;
  parentName: string | null;
  rows: FamilyRow[];
  onMarkArrived: (booking: FamilyRow) => void;
  onMarkDeparted: (booking: FamilyRow) => void;
}

const fmt = (d: string) =>
  new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/**
 * Shown after a staff member scans a family QR code. One scan covers every
 * child (or adult) this parent has booked on the class — NOTHING is marked
 * automatically. Staff mark each attendee Arrived/Departed individually
 * (timestamped), or use the clearly-labelled mark-ALL shortcuts.
 */
const FamilyCheckInSheet = ({
  open,
  onOpenChange,
  className,
  sessionTime,
  parentName,
  rows,
  onMarkArrived,
  onMarkDeparted,
}: Props) => {
  const displayName = (r: FamilyRow) =>
    r.students
      ? r.students.is_self
        ? `${r.students.first_name} ${r.students.last_name} (adult)`
        : `${r.students.first_name} ${r.students.last_name}`
      : "Adult attendee";

  const notArrived = rows.filter((r) => !r.attendance?.checked_in_at && r.attendance?.status !== "absent");
  const arrivedNotDeparted = rows.filter((r) => r.attendance?.checked_in_at && !r.attendance?.checked_out_at);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" /> QR Scanned — Family Check-In
          </DialogTitle>
          <DialogDescription>
            {className} · {sessionTime}
            {parentName && <> · booked by <span className="font-medium text-foreground">{parentName}</span></>}
          </DialogDescription>
        </DialogHeader>

        <p className="text-xs text-muted-foreground -mt-1">
          Nobody has been marked yet. Tap <span className="font-semibold text-foreground">Arrived</span> or{" "}
          <span className="font-semibold text-foreground">Departed</span> next to each name, or use the
          mark-everyone shortcuts below.
        </p>

        {/* Shortcuts — clearly labelled as ALL */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            className="gap-1.5 bg-success text-success-foreground hover:bg-success/90 h-auto py-2.5 flex-col"
            disabled={notArrived.length === 0}
            onClick={() => notArrived.forEach(onMarkArrived)}
          >
            <span className="flex items-center gap-1.5"><LogIn className="w-4 h-4" /> Mark ALL arrived</span>
            <span className="text-[10px] font-normal opacity-80">
              {notArrived.length === 0 ? "everyone is in" : `${notArrived.length} ${notArrived.length === 1 ? "person" : "people"}`}
            </span>
          </Button>
          <Button
            className="gap-1.5 bg-blue-500 text-white hover:bg-blue-600 h-auto py-2.5 flex-col"
            disabled={arrivedNotDeparted.length === 0}
            onClick={() => arrivedNotDeparted.forEach(onMarkDeparted)}
          >
            <span className="flex items-center gap-1.5"><LogOut className="w-4 h-4" /> Mark ALL departed</span>
            <span className="text-[10px] font-normal opacity-80">
              {arrivedNotDeparted.length === 0 ? "no one to sign out" : `${arrivedNotDeparted.length} ${arrivedNotDeparted.length === 1 ? "person" : "people"}`}
            </span>
          </Button>
        </div>

        {/* Individual attendees */}
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> On this booking ({rows.length})
          </p>
          {rows.map((r) => {
            const att = r.attendance;
            const isIn = !!att?.checked_in_at && !att?.checked_out_at;
            const isOut = !!att?.checked_out_at;
            const isAbsent = att?.status === "absent";
            const s = r.students;
            const urgent = s?.has_epipen || s?.has_inhaler;
            return (
              <Card key={r.id} className="p-3">
                <div className="flex items-center gap-3">
                  {s?.profile_photo ? (
                    <img src={s.profile_photo} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold shrink-0">
                      {s?.first_name?.[0] ?? "A"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate flex items-center gap-1.5">
                      {displayName(r)}
                      {urgent && (
                        <span title="EpiPen / Inhaler"><AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" /></span>
                      )}
                      {s?.has_send && <Badge className="text-[9px] bg-amber-500 hover:bg-amber-600">SEND</Badge>}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {isAbsent ? "Marked absent"
                        : isOut ? `In ${fmt(att!.checked_in_at!)} · Out ${fmt(att!.checked_out_at!)}`
                        : isIn ? `Arrived ${fmt(att!.checked_in_at!)}`
                        : "Not arrived yet"}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      className="gap-1 h-8 px-2.5 bg-success text-success-foreground hover:bg-success/90 disabled:opacity-40"
                      disabled={isIn || isOut}
                      onClick={() => onMarkArrived(r)}
                      title={`Mark ${displayName(r)} arrived`}
                    >
                      <LogIn className="w-3.5 h-3.5" /> Arrived
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1 h-8 px-2.5 bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40"
                      disabled={!isIn}
                      onClick={() => onMarkDeparted(r)}
                      title={`Mark ${displayName(r)} departed`}
                    >
                      <LogOut className="w-3.5 h-3.5" /> Departed
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
          Done
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default FamilyCheckInSheet;
