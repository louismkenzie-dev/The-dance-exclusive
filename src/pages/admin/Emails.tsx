import { useEffect, useMemo, useState } from "react";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { Loader2, Mail, Send, Users } from "lucide-react";

type AudienceKind = "all_parents" | "class" | "camp" | "venue" | "staff";

/** The three "pick one" lists share a shape, so one type serves all of them. */
interface NamedOption { id: string; name: string }

interface BroadcastRow {
  id: string;
  subject: string;
  audience_label: string | null;
  recipient_count: number;
  failed_count: number;
  status: string;
  created_at: string;
}

const AUDIENCE_LABEL: Record<AudienceKind, string> = {
  all_parents: "All parents with a booking",
  class: "Parents in one class",
  camp: "Parents booked on one event",
  venue: "Parents at one venue",
  staff: "All active staff",
};

const AdminEmails = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [kind, setKind] = useState<AudienceKind>("all_parents");
  const [targetId, setTargetId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: classes = [] } = useQuery({
    queryKey: ["emails-classes"],
    queryFn: async (): Promise<NamedOption[]> => {
      const { data, error } = await supabase
        .from("classes").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: camps = [] } = useQuery({
    queryKey: ["emails-camps"],
    queryFn: async (): Promise<NamedOption[]> => {
      const { data, error } = await supabase
        .from("camps").select("id, name").eq("is_active", true).order("start_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: venues = [] } = useQuery({
    queryKey: ["emails-venues"],
    queryFn: async (): Promise<NamedOption[]> => {
      const { data, error } = await supabase.from("venues").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["emails-history"],
    queryFn: async (): Promise<BroadcastRow[]> => {
      const { data, error } = await supabase
        .from("email_broadcasts")
        .select("id, subject, audience_label, recipient_count, failed_count, status, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const needsTarget = kind === "class" || kind === "camp" || kind === "venue";
  const audience = useMemo(() => {
    if (kind === "class") return { kind, classId: targetId };
    if (kind === "camp") return { kind, campId: targetId };
    if (kind === "venue") return { kind, venueId: targetId };
    return { kind };
  }, [kind, targetId]);

  const audienceLabel = useMemo(() => {
    if (kind === "class") return `Class: ${classes.find((c) => c.id === targetId)?.name ?? "—"}`;
    if (kind === "camp") return `Event: ${camps.find((c) => c.id === targetId)?.name ?? "—"}`;
    if (kind === "venue") return `Venue: ${venues.find((v) => v.id === targetId)?.name ?? "—"}`;
    return AUDIENCE_LABEL[kind];
  }, [kind, targetId, classes, camps, venues]);

  // How many people this would actually reach — always shown before sending,
  // because "send to everyone" should never be a guess.
  useEffect(() => {
    setCount(null);
    if (needsTarget && !targetId) return;
    let cancelled = false;
    setCounting(true);
    void (async () => {
      const { data, error } = await supabase.functions.invoke("send-bulk-email", {
        body: { audience, preview: true },
      });
      if (cancelled) return;
      setCounting(false);
      if (!error && typeof data?.recipientCount === "number") setCount(data.recipientCount);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, targetId]);

  const canSend = subject.trim().length > 0 && body.trim().length > 0 && (!needsTarget || !!targetId) && (count ?? 0) > 0;

  const send = async () => {
    setConfirmOpen(false);
    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-bulk-email", {
      body: { audience, audienceLabel, subject: subject.trim(), body: body.trim() },
    });
    setSending(false);

    let message = data?.error || error?.message;
    const ctx = (error as { context?: Response } | null)?.context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const parsed = await ctx.json();
        if (parsed?.error) message = parsed.error;
      } catch { /* keep the generic message */ }
    }
    if (error || !data?.success) {
      toast({ title: "Couldn't send", description: message || "Please try again.", variant: "destructive" });
      return;
    }
    toast({
      title: `Sent to ${data.sent} ${data.sent === 1 ? "person" : "people"}`,
      description: data.failed > 0 ? `${data.failed} couldn't be delivered — see the history below.` : undefined,
    });
    setSubject("");
    setBody("");
    void queryClient.invalidateQueries({ queryKey: ["emails-history"] });
  };

  const targetOptions = kind === "class" ? classes : kind === "camp" ? camps : venues;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Mail className="w-6 h-6 text-primary" /> Bulk Emails
        </h1>
        <p className="text-sm text-muted-foreground">
          Write once, send to a whole class, a venue, an event or every family — in the studio&rsquo;s own branding.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 md:p-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Send to</Label>
              <Select value={kind} onValueChange={(v) => { setKind(v as AudienceKind); setTargetId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(AUDIENCE_LABEL) as AudienceKind[]).map((k) => (
                    <SelectItem key={k} value={k}>{AUDIENCE_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {needsTarget && (
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {kind === "class" ? "Class" : kind === "camp" ? "Event" : "Venue"}
                </Label>
                <Select value={targetId} onValueChange={setTargetId}>
                  <SelectTrigger><SelectValue placeholder="Choose one" /></SelectTrigger>
                  <SelectContent>
                    {targetOptions.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-muted-foreground" />
            {counting ? (
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Counting who this reaches…
              </span>
            ) : count === null ? (
              <span className="text-muted-foreground">Choose a group to see how many people it reaches.</span>
            ) : (
              <span>
                <span className="font-semibold">{count}</span> {count === 1 ? "person" : "people"} will get this email.
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={150}
              placeholder="e.g. Show tickets are on sale"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Message</Label>
            <Textarea
              rows={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={5000}
              placeholder={"Write it as you would in an email.\n\nLeave a blank line between paragraphs."}
            />
            <p className="text-[11px] text-muted-foreground">
              {body.length}/5000 characters. Everyone gets it individually — nobody sees anyone else&rsquo;s address.
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={!canSend || sending}
              className="gap-1.5"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? "Sending…" : "Send email"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 md:p-6">
          <h2 className="font-semibold mb-3">Recently sent</h2>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nothing sent yet.</p>
          ) : (
            <div className="space-y-2">
              {history.map((h) => (
                <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{h.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {h.audience_label ?? "—"} · {format(parseISO(h.created_at), "d MMM yyyy, HH:mm")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{h.recipient_count} sent</Badge>
                    {h.failed_count > 0 && <Badge variant="destructive">{h.failed_count} failed</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this to {count} {count === 1 ? "person" : "people"}?</AlertDialogTitle>
            <AlertDialogDescription>
              {audienceLabel}. This goes out straight away and can&rsquo;t be recalled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void send()}>Send it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminEmails;
