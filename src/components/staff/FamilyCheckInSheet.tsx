import { AlertTriangle, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveSheet } from "@/components/booking/ResponsiveSheet";
import PhotoAvatarDuo from "@/components/PhotoAvatarDuo";
import { initialsOf } from "@/lib/initials";
import { registerState } from "@/lib/registerRules";
import { cn } from "@/lib/utils";

interface FamilyRow {
  id: string; // booking id
  student_id: string | null;
  students: {
    first_name: string;
    last_name: string;
    preferred_name?: string | null;
    profile_photo?: string | null;
    avatar_url?: string | null;
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
  /** Whether departures are recorded at all (see REGISTER_DEPARTURES). */
  departures?: boolean;
  /** Arrivals may only be recorded from 15 minutes before the class. */
  arrivalsOpen?: boolean;
  /** "Opens at 4:45pm" — shown while arrivals are closed. */
  arrivalsOpenLabel?: string | null;
}

const fmt = (d: string) =>
  new Date(d)
    .toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true })
    .replace(/\s?([ap])\.?m\.?/i, (_, x) => x.toLowerCase() + "m");

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
  departures = true,
  arrivalsOpen = true,
  arrivalsOpenLabel,
}: Props) => {
  const displayName = (r: FamilyRow) =>
    r.students
      ? `${r.students.preferred_name || r.students.first_name} ${r.students.last_name}${r.students.is_self ? " (adult)" : ""}`
      : "Adult attendee";

  const notArrived = rows.filter((r) => registerState(r.attendance) === "unaccounted");
  const inRoom = rows.filter((r) => registerState(r.attendance) === "in");

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Family check-in"
      description={
        <>
          {className} · {sessionTime}
          {parentName && <> · booked by <span className="font-medium text-foreground">{parentName}</span></>}
        </>
      }
      footer={
        <Button type="button" variant="ink" size="xl" className="w-full rounded-xl" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      }
    >
      <p className="text-[13px] text-muted-foreground">
        Nobody is marked automatically. Mark each person, or everyone at once.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          type="button"
          className="h-12 rounded-xl bg-success text-success-foreground hover:bg-success/90 disabled:opacity-50"
          disabled={notArrived.length === 0 || !arrivalsOpen}
          onClick={() => notArrived.forEach(onMarkArrived)}
        >
          <LogIn className="h-4 w-4" /> All arrived{notArrived.length > 0 ? ` (${notArrived.length})` : ""}
        </Button>
        {departures && (
          <Button
            type="button"
            className="h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            disabled={inRoom.length === 0}
            onClick={() => inRoom.forEach(onMarkDeparted)}
          >
            <LogOut className="h-4 w-4" /> All departed{inRoom.length > 0 ? ` (${inRoom.length})` : ""}
          </Button>
        )}
      </div>
      {!arrivalsOpen && arrivalsOpenLabel && (
        <p className="mt-2 text-[13px] text-warning">Arrivals {arrivalsOpenLabel.toLowerCase().replace(/^opens/, "open")}.</p>
      )}

      <p className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        On this booking · {rows.length}
      </p>
      <div className="mt-2 space-y-2">
        {rows.map((r) => {
          const state = registerState(r.attendance);
          const att = r.attendance;
          const s = r.students;
          const urgent = s?.has_epipen || s?.has_inhaler;
          return (
            <div
              key={r.id}
              className={cn(
                "surface flex items-center gap-3 px-3 py-3",
                state === "in" && "border-success/40 bg-success/10",
                state === "out" && "border-primary/40 bg-primary/10",
                state === "absent" && "border-destructive/40 bg-destructive/10",
              )}
            >
              <PhotoAvatarDuo
                photoUrl={s?.profile_photo}
                avatarUrl={s?.avatar_url}
                initials={initialsOf(s?.first_name, s?.last_name)}
                size="sm"
                expandable
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-[15px] font-semibold text-foreground">
                  {displayName(r)}
                  {urgent && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" aria-label="EpiPen or inhaler" />}
                  {s?.has_send && <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-[hsl(var(--warning-strong))]">SEND</span>}
                </p>
                <p className="text-[13px] text-muted-foreground">
                  {state === "absent"
                    ? "Marked absent"
                    : state === "out"
                      ? `In ${fmt(att!.checked_in_at!)} · Out ${fmt(att!.checked_out_at!)}`
                      : state === "in"
                        ? `Arrived ${fmt(att!.checked_in_at!)}`
                        : "Not arrived yet"}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {state === "in" && !departures ? (
                  <span className="inline-flex h-10 items-center rounded-full bg-success/15 px-3.5 text-[13px] font-semibold text-[hsl(var(--success-strong))]">
                    Arrived
                  </span>
                ) : state === "in" ? (
                  <Button
                    type="button"
                    size="sm"
                    className="h-10 rounded-full bg-primary px-3.5 text-primary-foreground hover:bg-primary/90"
                    onClick={() => onMarkDeparted(r)}
                    aria-label={`Mark ${displayName(r)} departed`}
                  >
                    <LogOut className="h-4 w-4" /> Departed
                  </Button>
                ) : state === "unaccounted" ? (
                  <Button
                    type="button"
                    size="sm"
                    className="h-10 rounded-full bg-success px-3.5 text-success-foreground hover:bg-success/90 disabled:opacity-50"
                    disabled={!arrivalsOpen}
                    onClick={() => onMarkArrived(r)}
                    aria-label={`Mark ${displayName(r)} arrived`}
                  >
                    <LogIn className="h-4 w-4" /> Arrived
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </ResponsiveSheet>
  );
};

export default FamilyCheckInSheet;
