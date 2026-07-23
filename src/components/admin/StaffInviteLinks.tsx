import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Check, Copy, Link2, Loader2, Plus, Trash2 } from "lucide-react";

interface InviteRow {
  id: string;
  token: string;
  note: string | null;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  staff: { full_name: string } | null;
}

/**
 * Self-service onboarding links: Amie generates a link, sends it to the new
 * team member over WhatsApp/email, they fill in their own details on the
 * public form, and the submission appears in this Staff list for review.
 */
const StaffInviteLinks = ({ onStaffAdded }: { onStaffAdded?: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const linkFor = (token: string) => `${window.location.origin}/staff-onboarding/${token}`;

  const fetchInvites = useCallback(async () => {
    const { data } = await supabase
      .from("staff_invites")
      .select("id, token, note, created_at, expires_at, used_at, staff(full_name)")
      .order("created_at", { ascending: false })
      .limit(20);
    setInvites((data as unknown as InviteRow[]) ?? []);
  }, []);
  useEffect(() => {
    if (open) fetchInvites();
  }, [open, fetchInvites]);

  const createInvite = async () => {
    setCreating(true);
    const { data, error } = await supabase
      .from("staff_invites")
      .insert({ created_by: user?.id ?? null })
      .select("id, token")
      .single();
    setCreating(false);
    if (error || !data) {
      toast({ title: "Could not create link", description: error?.message, variant: "destructive" });
      return;
    }
    await navigator.clipboard.writeText(linkFor(data.token)).catch(() => {});
    toast({ title: "Invite link created", description: "Copied to your clipboard — send it to the new team member." });
    fetchInvites();
    onStaffAdded?.();
  };

  const copy = async (row: InviteRow) => {
    await navigator.clipboard.writeText(linkFor(row.token)).catch(() => {});
    setCopiedId(row.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const revoke = async (row: InviteRow) => {
    const { error } = await supabase.from("staff_invites").delete().eq("id", row.id);
    if (error) toast({ title: "Could not revoke", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Invite link revoked" });
      fetchInvites();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Link2 className="w-4 h-4 mr-2" /> Invite Link
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" /> Staff onboarding links
          </DialogTitle>
          <DialogDescription>
            Generate a single-use link and send it to a new team member. They fill in
            their own details on a secure form, and the submission appears in your
            Staff list ready to review and invite to the portal.
          </DialogDescription>
        </DialogHeader>

        <Button onClick={createInvite} disabled={creating} className="w-full">
          {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          Generate new link
        </Button>

        <div className="space-y-2 max-h-72 overflow-y-auto">
          {invites.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No links generated yet.</p>
          ) : (
            invites.map((row) => {
              const expired = !row.used_at && new Date(row.expires_at) < new Date();
              return (
                <div key={row.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {row.used_at
                        ? `Completed — ${row.staff?.full_name ?? "details submitted"}`
                        : `…${row.token.slice(-8)}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.used_at
                        ? `Submitted ${format(new Date(row.used_at), "d MMM, HH:mm")}`
                        : `Created ${format(new Date(row.created_at), "d MMM")} · expires ${format(new Date(row.expires_at), "d MMM")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {row.used_at ? (
                      <Badge variant="secondary" className="text-[10px]">Used</Badge>
                    ) : expired ? (
                      <Badge variant="outline" className="text-[10px] border-destructive/50 text-destructive">Expired</Badge>
                    ) : (
                      <>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copy(row)} aria-label="Copy link">
                          {copiedId === row.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => revoke(row)} aria-label="Revoke link">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StaffInviteLinks;
