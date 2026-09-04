import { Check, Eye, Lock, ShieldCheck } from "lucide-react";

interface StaffAccessSummaryProps {
  /** The role currently chosen on the staff form. */
  role: string;
}

/**
 * What this person will actually be able to see once they log in.
 *
 * The studio asked what assistants and assistant instructors can see of
 * parents' and children's details. The honest answer is that every non-admin
 * staff account gets the same thing — the classes they're assigned to — so
 * spell it out on the form where the role is chosen, rather than leaving it
 * to be guessed.
 */
const StaffAccessSummary = ({ role }: StaffAccessSummaryProps) => {
  const isAdmin = role === "admin" || role === "ceo_owner";

  const canSee = isAdmin
    ? [
        "Everything in the admin area: every class, venue, family and booking",
        "Payments, refunds, memberships and the financial report",
        "Full parent and child records, including contact and address details",
      ]
    : [
        "Only the classes they are assigned to — nothing from any other class",
        "The register for those classes: name, photo, age and attendance",
        "Medical, allergy and SEND details for those dancers (safeguarding)",
        "Each child's emergency contacts and authorised collectors",
        "The family's pickup PIN, to verify who is collecting at the door",
      ];

  const cannotSee = isAdmin
    ? []
    : [
        "Parents' phone numbers, email addresses or home addresses",
        "Anything about a family whose child is not in one of their classes",
        "Payments, invoices, memberships or anyone's financial information",
        "Other staff members' pay, documents or personal details",
      ];

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2.5">
      <p className="text-xs font-semibold flex items-center gap-1.5">
        {isAdmin ? <ShieldCheck className="w-3.5 h-3.5 text-amber-500" /> : <Eye className="w-3.5 h-3.5 text-primary" />}
        What this person can see
      </p>
      <ul className="space-y-1">
        {canSee.map((line) => (
          <li key={line} className="text-xs text-muted-foreground flex items-start gap-1.5">
            <Check className="w-3 h-3 mt-0.5 flex-shrink-0 text-emerald-500" />
            {line}
          </li>
        ))}
      </ul>
      {cannotSee.length > 0 && (
        <>
          <p className="text-xs font-semibold flex items-center gap-1.5 pt-1">
            <Lock className="w-3.5 h-3.5 text-muted-foreground" /> What they can&rsquo;t see
          </p>
          <ul className="space-y-1">
            {cannotSee.map((line) => (
              <li key={line} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="w-3 flex-shrink-0 text-center text-muted-foreground/60">—</span>
                {line}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="text-[11px] text-muted-foreground/80 pt-1">
        {isAdmin
          ? "Admin and CEO/Owner roles have full access. Give this role only to people who should see everything."
          : "Every non-admin role — instructor, assistant instructor, assistant, receptionist, volunteer — sees exactly this much, and only for the classes you assign them to."}
      </p>
    </div>
  );
};

export default StaffAccessSummary;
