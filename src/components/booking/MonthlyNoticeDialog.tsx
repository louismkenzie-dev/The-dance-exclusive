import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { MONTHLY_MEMBERSHIP_NOTICE, MONTHLY_PAYMENT_INFO } from "@/lib/pricing";
import { cn } from "@/lib/utils";

interface MonthlyNoticeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the parent agrees; the dialog closes itself first. */
  onAgree: () => void;
  /** "I agree, add to basket" / "I agree, switch plan". */
  agreeLabel?: string;
  /** Theme + portal-ui classes, since the dialog portals to <body>. */
  themeClass?: string;
}

/**
 * The monthly-membership acknowledgement a parent must give before a
 * membership goes in the basket: the cancellation notice, then how payments
 * run. Same copy wherever a membership is chosen.
 */
export function MonthlyNoticeDialog({
  open,
  onOpenChange,
  onAgree,
  agreeLabel = "I agree, add to basket",
  themeClass,
}: MonthlyNoticeDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className={cn(
          "w-[calc(100%-2rem)] max-w-md gap-5 rounded-2xl border-border bg-card p-6 text-card-foreground shadow-2xl sm:rounded-2xl",
          themeClass,
        )}
      >
        <AlertDialogHeader className="space-y-2 text-left">
          <AlertDialogTitle className="text-lg font-semibold tracking-tight text-foreground">
            Before you join monthly
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-[13px] leading-relaxed text-muted-foreground">
              <p className="text-sm text-foreground">{MONTHLY_MEMBERSHIP_NOTICE}</p>
              <p>{MONTHLY_PAYMENT_INFO}</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:space-x-0">
          <AlertDialogCancel className={cn(buttonVariants({ variant: "soft" }), "mt-0 h-12 rounded-xl px-5")}>
            Go back
          </AlertDialogCancel>
          <AlertDialogAction
            className="h-12 rounded-xl px-5 font-semibold"
            onClick={() => {
              onOpenChange(false);
              onAgree();
            }}
          >
            {agreeLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default MonthlyNoticeDialog;
