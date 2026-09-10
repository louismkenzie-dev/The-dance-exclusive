import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPage, DesktopOnly, EmptyState, Fab, FilterBar, PageHeader, PhoneOnly, RecordCard, RecordList } from "@/components/admin/ui";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ShieldCheck, Search, Mail, Plus, Pencil, ShieldOff, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type AdminProfile = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
};

const AdminAdmins = () => {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminProfile | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AdminProfile | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [createForm, setCreateForm] = useState({ fullName: "", email: "", password: "", phone: "" });
  const [editForm, setEditForm] = useState({ fullName: "", email: "", phone: "", password: "" });

  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: adminUsers = [], isLoading } = useQuery({
    queryKey: ["admin-admins-list"],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      if (rolesError) throw rolesError;
      if (!roles || roles.length === 0) return [];

      const userIds = roles.map((r) => r.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", userIds)
        .order("full_name");
      if (profilesError) throw profilesError;
      return (profiles || []) as AdminProfile[];
    },
  });

  const filtered = adminUsers.filter((p) => {
    const q = search.toLowerCase();
    return p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
  });

  const handleCreate = async () => {
    if (!createForm.fullName || !createForm.email || !createForm.password) {
      toast({ title: "Missing info", description: "Name, email, and password are required.", variant: "destructive" });
      return;
    }
    if (createForm.password.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("admin-manage-admins", {
      body: {
        action: "create",
        fullName: createForm.fullName,
        email: createForm.email,
        password: createForm.password,
        phone: createForm.phone || null,
      },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast({ title: "Failed to create admin", description: error?.message || (data as any)?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Admin created", description: `${createForm.fullName} can now sign in.` });
    setCreateForm({ fullName: "", email: "", password: "", phone: "" });
    setCreateOpen(false);
    qc.invalidateQueries({ queryKey: ["admin-admins-list"] });
  };

  const openEdit = (admin: AdminProfile) => {
    setEditForm({
      fullName: admin.full_name,
      email: admin.email,
      phone: admin.phone ?? "",
      password: "",
    });
    setEditTarget(admin);
  };

  const handleUpdate = async () => {
    if (!editTarget) return;
    if (editForm.password && editForm.password.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("admin-manage-admins", {
      body: {
        action: "update",
        userId: editTarget.user_id,
        fullName: editForm.fullName,
        email: editForm.email,
        phone: editForm.phone || null,
        password: editForm.password || undefined,
      },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast({ title: "Update failed", description: error?.message || (data as any)?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Admin updated" });
    setEditTarget(null);
    qc.invalidateQueries({ queryKey: ["admin-admins-list"] });
  };

  const handleRemoveAdmin = async () => {
    if (!removeTarget) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("admin-manage-admins", {
      body: { action: "remove_admin", userId: removeTarget.user_id },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast({ title: "Failed to remove admin", description: error?.message || (data as any)?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Admin access removed" });
    setRemoveTarget(null);
    qc.invalidateQueries({ queryKey: ["admin-admins-list"] });
  };

  return (
    <AdminPage hasFab>
      <PageHeader
        title="Admins"
        count={filtered.length}
        subtitle="Everyone who can get into the studio's back office"
        actionDesktopOnly
        action={
          <Button onClick={() => setCreateOpen(true)} className="rounded-full">
            <Plus className="mr-1.5 h-4 w-4" /> New admin
          </Button>
        }
      />

      <FilterBar className="mt-5" search={search} onSearch={setSearch} searchPlaceholder="Search admins…" />

      <div className="mt-5">
          {isLoading ? (
            <p className="py-8 text-center text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <EmptyState title="No admins found" body="Try a different name or email." />
          ) : (
            <>
            <PhoneOnly>
              <RecordList>
                {filtered.map((admin) => (
                  <RecordCard
                    key={admin.id}
                    title={
                      <>
                        {admin.full_name}
                        {admin.user_id === user?.id && <Badge variant="outline" className="ml-2 text-xs">You</Badge>}
                      </>
                    }
                    meta={
                      <>
                        <p className="flex items-center gap-1.5 break-all"><Mail className="h-3.5 w-3.5 shrink-0" />{admin.email}</p>
                        <p>Admin since {format(new Date(admin.created_at), "d MMM yyyy")}</p>
                      </>
                    }
                    actions={
                      <>
                        <Button variant="soft" size="sm" className="h-9 gap-1.5 rounded-full" onClick={() => openEdit(admin)}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button
                          variant="soft"
                          size="sm"
                          className="h-9 gap-1.5 rounded-full text-destructive"
                          disabled={admin.user_id === user?.id}
                          onClick={() => setRemoveTarget(admin)}
                        >
                          <ShieldOff className="h-3.5 w-3.5" /> Remove
                        </Button>
                      </>
                    }
                  />
                ))}
              </RecordList>
            </PhoneOnly>
            <DesktopOnly className="surface overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">
                      {admin.full_name}
                      {admin.user_id === user?.id && (
                        <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-sm">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        {admin.email}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(admin.created_at), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(admin)}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={admin.user_id === user?.id}
                          onClick={() => setRemoveTarget(admin)}
                        >
                          <ShieldOff className="h-3.5 w-3.5" /> Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </DesktopOnly>
            </>
          )}
      </div>

      <Fab onClick={() => setCreateOpen(true)} icon={<Plus className="h-5 w-5" />}>New admin</Fab>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Admin</DialogTitle>
            <DialogDescription>Create a new account with administrator access.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-name">Full name</Label>
              <Input id="new-name" value={createForm.fullName} onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">Email</Label>
              <Input id="new-email" type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-phone">Phone (optional)</Label>
              <Input id="new-phone" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Temporary password</Label>
              <Input id="new-password" type="text" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
              <p className="text-xs text-muted-foreground">Share this with the new admin so they can sign in. They can change it later.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Create Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Admin</DialogTitle>
            <DialogDescription>Update profile details or reset the password.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full name</Label>
              <Input id="edit-name" value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input id="edit-phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">New password (leave blank to keep current)</Label>
              <Input id="edit-password" type="text" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove admin confirmation */}
      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove admin access?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.full_name} will lose administrator access but their account will remain active as a regular user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveAdmin} disabled={submitting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Remove Admin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  );
};

export default AdminAdmins;
