import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles } from "lucide-react";

interface DescriptionAssistButtonProps {
  /** What's being described — "class", "workshop", "camp", "class pass". */
  kind: string;
  /** The thing's name; nothing is drafted without one. */
  name: string;
  /** Whatever else is filled in — missing pieces are simply left out. */
  facts?: {
    danceStyle?: string | null;
    audience?: string | null;
    ages?: string | null;
    durationMinutes?: number | null;
    level?: string | null;
    venue?: string | null;
    notes?: string | null;
  };
  /** Current text — passed so the draft improves it rather than ignoring it. */
  existing?: string;
  onDrafted: (description: string) => void;
  className?: string;
}

/**
 * "Write it for me" next to a description box. Always produces a DRAFT the
 * admin can edit before saving — it never writes to the database itself.
 */
const DescriptionAssistButton = ({
  kind,
  name,
  facts,
  existing,
  onDrafted,
  className,
}: DescriptionAssistButtonProps) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const draft = async () => {
    if (!name.trim()) {
      toast({
        title: "Give it a name first",
        description: "Then I can draft a description around it.",
      });
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-description", {
        body: { kind, name, existing, ...(facts ?? {}) },
      });
      let message = data?.error || error?.message;
      const ctx = (error as { context?: Response } | null)?.context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const b = await ctx.json();
          if (b?.error) message = b.error;
        } catch { /* keep generic */ }
      }
      if (error || !data?.success) {
        toast({
          title: "Couldn't write one",
          description: message || "Please try again.",
          variant: "destructive",
        });
        return;
      }
      onDrafted(data.description);
      toast({ title: "Draft ready", description: "Have a read and tweak anything you like." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={draft}
      className={className}
    >
      {busy
        ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
        : <Sparkles className="w-3.5 h-3.5 mr-1.5 text-primary" />}
      {busy ? "Writing…" : existing?.trim() ? "Improve with AI" : "Write it for me"}
    </Button>
  );
};

export default DescriptionAssistButton;
