import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ImagePlus, Loader2, Trash2, Pencil, Check, X } from "lucide-react";

interface BrandLogo {
  id: string;
  title: string;
  image_url: string;
  display_order: number;
}

export const BrandLogoLibrary = () => {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const { data: logos = [], isLoading } = useQuery({
    queryKey: ["brand-logos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_logos")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as BrandLogo[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("brand_logos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-logos"] });
      toast.success("Logo removed");
    },
    onError: (e: any) => toast.error("Failed to delete: " + e.message),
  });

  const updateTitleMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase
        .from("brand_logos")
        .update({ title, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-logos"] });
      setEditingId(null);
      toast.success("Title updated");
    },
    onError: (e: any) => toast.error("Failed to update: " + e.message),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File must be less than 5MB");
      return;
    }

    const title = newTitle.trim() || file.name.replace(/\.[^.]+$/, "");
    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `brand-logo-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("branding")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("branding")
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase.from("brand_logos").insert({
        title,
        image_url: urlData.publicUrl,
        display_order: logos.length,
      });
      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ["brand-logos"] });
      setNewTitle("");
      toast.success("Logo added to library");
    } catch (err: any) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
    e.target.value = "";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImagePlus className="h-5 w-5" />
          Logo Library
        </CardTitle>
        <CardDescription>
          Upload multiple logo variations with titles for use across the app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 p-4 border rounded-lg border-dashed">
          <div className="flex-1 space-y-1.5 w-full">
            <Label htmlFor="logoTitle">Logo Title</Label>
            <Input
              id="logoTitle"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder='e.g. "Full Colour", "White on Dark", "Icon Only"'
            />
          </div>
          <Button variant="outline" className="relative shrink-0" disabled={uploading}>
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="mr-2 h-4 w-4" />
            )}
            Upload Logo
            <input
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="absolute inset-0 cursor-pointer opacity-0"
              disabled={uploading}
            />
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : logos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No logos uploaded yet. Add your first logo variation above.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {logos.map((logo) => (
              <div
                key={logo.id}
                className="group relative border rounded-lg p-3 space-y-2 bg-muted/30"
              >
                <div className="aspect-square rounded-md border bg-background flex items-center justify-center overflow-hidden">
                  <img
                    src={logo.image_url}
                    alt={logo.title}
                    className="max-h-full max-w-full object-contain p-2"
                  />
                </div>
                {editingId === logo.id ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="h-7 text-xs"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") updateTitleMutation.mutate({ id: logo.id, title: editTitle });
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => updateTitleMutation.mutate({ id: logo.id, title: editTitle })}>
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setEditingId(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <p
                    className="text-xs font-medium text-center truncate cursor-pointer hover:text-primary flex items-center justify-center gap-1"
                    onClick={() => { setEditingId(logo.id); setEditTitle(logo.title); }}
                  >
                    {logo.title}
                    <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50" />
                  </p>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                  onClick={() => deleteMutation.mutate(logo.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
