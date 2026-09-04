import { Cake, Ticket } from "lucide-react";

interface RegisterLegendProps {
  /** How many dancers on this register have a birthday this week. */
  birthdayCount: number;
  /** How many are attending on a class pass. */
  passCount: number;
  className?: string;
}

/**
 * What the little icons on a register mean.
 *
 * The cake caused real confusion — it marks a birthday anywhere in the class's
 * Monday–Sunday week, not only today, so a busy register can show several at
 * once. Saying so on the register itself is quicker than asking.
 */
const RegisterLegend = ({ birthdayCount, passCount, className = "" }: RegisterLegendProps) => {
  if (birthdayCount === 0 && passCount === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground ${className}`}>
      {birthdayCount > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <Cake className="w-3.5 h-3.5 text-pink-400/70" />
          Birthday this week (a filled-in pink cake means it&rsquo;s today)
        </span>
      )}
      {passCount > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <Ticket className="w-3.5 h-3.5 text-sky-500" />
          Booked with a class pass, not a one-off payment
        </span>
      )}
    </div>
  );
};

export default RegisterLegend;
