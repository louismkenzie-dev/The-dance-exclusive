import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, Image, Star, ArrowLeft, ArrowRight, Plus } from "lucide-react";

interface VenuePhotoUploadProps {
  venueId: string;
  label: string;
  description: string;
  currentUrl: string | null;
  photoType: "outside" | "indoor" | "parking";
  onUploaded: (url: string | null) => void;
}

const VenuePhotoUpload = ({ venueId, label, description, currentUrl, photoType, onUploaded }: VenuePhotoUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file.", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max file size is 5MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${venueId}/${photoType}.${ext}`;

    // Remove old file if exists
    if (currentUrl) {
      const oldPath = currentUrl.split("/venue-photos/")[1];
      if (oldPath) await supabase.storage.from("venue-photos").remove([oldPath]);
    }

    const { error } = await supabase.storage.from("venue-photos").upload(path, file, { upsert: true });

    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("venue-photos").getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    // Save URL to venue record
    const column = `photo_${photoType}`;
    await supabase.from("venues").update({ [column]: publicUrl }).eq("id", venueId);

    onUploaded(publicUrl);
    setUploading(false);
    toast({ title: "Photo uploaded" });

    // Reset file input
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleRemove = async () => {
    if (!currentUrl) return;
    const oldPath = currentUrl.split("/venue-photos/")[1];
    if (oldPath) await supabase.storage.from("venue-photos").remove([oldPath]);

    const column = `photo_${photoType}`;
    await supabase.from("venues").update({ [column]: null }).eq("id", venueId);

    onUploaded(null);
    toast({ title: "Photo removed" });
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground" style={{ fontFamily: 'var(--font-body)', textTransform: 'none', letterSpacing: 'normal' }}>
        {description}
      </p>

      {currentUrl ? (
        <div className="relative group rounded-lg overflow-hidden border border-border">
          <img src={currentUrl} alt={label} className="w-full h-48 object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="w-3 h-3 mr-1" /> Replace
            </Button>
            <Button type="button" size="sm" variant="destructive" onClick={handleRemove}>
              <X className="w-3 h-3 mr-1" /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full h-36 rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50"
        >
          <Image className="w-8 h-8" />
          <span className="text-sm">{uploading ? "Uploading..." : "Click to upload"}</span>
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
};

export default VenuePhotoUpload;

/* ------------------------------------------------------------------ */
/* Multi-photo gallery backed by the venue_photos table               */
/* ------------------------------------------------------------------ */

export interface VenuePhoto {
  id: string;
  venue_id: string;
  category: string;
  file_path: string;
  caption: string | null;
  is_primary: boolean;
  sort_order: number;
}

interface VenuePhotoGalleryProps {
  venueId: string;
  category: "outside" | "indoor" | "parking";
  label: string;
  description: string;
  /** Legacy single-photo public URL shown as a fallback when no gallery photos exist yet. */
  legacyUrl?: string | null;
}

const publicUrlFor = (filePath: string) =>
  supabase.storage.from("venue-photos").getPublicUrl(filePath).data.publicUrl;

export const VenuePhotoGallery = ({ venueId, category, label, description, legacyUrl }: VenuePhotoGalleryProps) => {
  const [photos, setPhotos] = useState<VenuePhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const loadPhotos = async () => {
    const { data } = await supabase
      .from("venue_photos")
      .select("*")
      .eq("venue_id", venueId)
      .eq("category", category)
      .order("sort_order", { ascending: true });
    if (data) setPhotos(data as VenuePhoto[]);
    setLoaded(true);
  };

  useEffect(() => {
    loadPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId, category]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        toast({ title: "Invalid file", description: `${file.name} is not an image.`, variant: "destructive" });
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "File too large", description: `${file.name} exceeds the 5MB limit.`, variant: "destructive" });
        continue;
      }
    }

    setUploading(true);
    let nextSort = photos.length > 0 ? Math.max(...photos.map((p) => p.sort_order)) + 1 : 0;
    let nextPrimaryNeeded = photos.length === 0;
    const inserted: VenuePhoto[] = [];

    for (const file of files) {
      if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) continue;

      const ext = file.name.split(".").pop();
      const path = `${venueId}/gallery/${category}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadError } = await supabase.storage.from("venue-photos").upload(path, file, { upsert: true });
      if (uploadError) {
        toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
        continue;
      }

      const makePrimary = nextPrimaryNeeded;
      nextPrimaryNeeded = false;

      const { data, error } = await supabase
        .from("venue_photos")
        .insert({
          venue_id: venueId,
          category,
          file_path: path,
          is_primary: makePrimary,
          sort_order: nextSort,
        })
        .select()
        .single();

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        await supabase.storage.from("venue-photos").remove([path]);
        continue;
      }
      if (data) inserted.push(data as VenuePhoto);
      nextSort += 1;
    }

    if (inserted.length > 0) {
      setPhotos((prev) => [...prev, ...inserted]);
      toast({ title: inserted.length === 1 ? "Photo uploaded" : `${inserted.length} photos uploaded` });
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDelete = async (photo: VenuePhoto) => {
    await supabase.storage.from("venue-photos").remove([photo.file_path]);
    const { error } = await supabase.from("venue_photos").delete().eq("id", photo.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    let remaining = photos.filter((p) => p.id !== photo.id);
    // If we removed the primary, promote the first remaining photo.
    if (photo.is_primary && remaining.length > 0 && !remaining.some((p) => p.is_primary)) {
      const promote = remaining[0];
      await supabase.from("venue_photos").update({ is_primary: true }).eq("id", promote.id);
      remaining = remaining.map((p) => (p.id === promote.id ? { ...p, is_primary: true } : p));
    }
    setPhotos(remaining);
    toast({ title: "Photo removed" });
  };

  const handleSetPrimary = async (photo: VenuePhoto) => {
    if (photo.is_primary) return;
    // Clear existing primary for this venue+category, then set the new one.
    await supabase
      .from("venue_photos")
      .update({ is_primary: false })
      .eq("venue_id", venueId)
      .eq("category", category);
    const { error } = await supabase.from("venue_photos").update({ is_primary: true }).eq("id", photo.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setPhotos((prev) => prev.map((p) => ({ ...p, is_primary: p.id === photo.id })));
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= photos.length) return;
    const reordered = [...photos];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    // Re-assign contiguous sort_order values.
    const withOrder = reordered.map((p, i) => ({ ...p, sort_order: i }));
    setPhotos(withOrder);
    await Promise.all(
      withOrder.map((p) => supabase.from("venue_photos").update({ sort_order: p.sort_order }).eq("id", p.id))
    );
  };

  const handleCaptionBlur = async (photo: VenuePhoto) => {
    await supabase.from("venue_photos").update({ caption: photo.caption || null }).eq("id", photo.id);
  };

  const updateCaption = (id: string, caption: string) => {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, caption } : p)));
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>{label}</Label>
        <p className="text-xs text-muted-foreground" style={{ fontFamily: 'var(--font-body)', textTransform: 'none', letterSpacing: 'normal' }}>
          {description}
        </p>
      </div>

      {/* Legacy single-photo fallback shown only when no gallery photos exist */}
      {loaded && photos.length === 0 && legacyUrl && (
        <div className="rounded-lg overflow-hidden border border-border/50">
          <img src={legacyUrl} alt={label} className="w-full h-40 object-cover" />
          <p className="text-[11px] text-muted-foreground px-2 py-1">Existing photo. Upload below to start a gallery.</p>
        </div>
      )}

      {photos.length > 0 && (
        <div className="space-y-3">
          {photos.map((photo, idx) => (
            <div key={photo.id} className="rounded-lg border border-border/50 overflow-hidden">
              <div className="relative group">
                <img src={publicUrlFor(photo.file_path)} alt={photo.caption || label} className="w-full h-40 object-cover" />
                {photo.is_primary && (
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                    <Star className="w-3 h-3 fill-current" /> Primary
                  </span>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                  {!photo.is_primary && (
                    <Button type="button" size="sm" variant="secondary" onClick={() => handleSetPrimary(photo)}>
                      <Star className="w-3 h-3 mr-1" /> Set primary
                    </Button>
                  )}
                  <Button type="button" size="icon" variant="secondary" className="h-8 w-8" disabled={idx === 0} onClick={() => handleMove(idx, -1)}>
                    <ArrowLeft className="w-3 h-3" />
                  </Button>
                  <Button type="button" size="icon" variant="secondary" className="h-8 w-8" disabled={idx === photos.length - 1} onClick={() => handleMove(idx, 1)}>
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                  <Button type="button" size="icon" variant="destructive" className="h-8 w-8" onClick={() => handleDelete(photo)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div className="p-2">
                <Input
                  value={photo.caption || ""}
                  onChange={(e) => updateCaption(photo.id, e.target.value)}
                  onBlur={() => handleCaptionBlur(photo)}
                  placeholder="Optional caption"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full h-24 rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50"
      >
        {photos.length > 0 ? <Plus className="w-6 h-6" /> : <Image className="w-7 h-7" />}
        <span className="text-xs">{uploading ? "Uploading..." : photos.length > 0 ? "Add more photos" : "Click to upload (multiple allowed)"}</span>
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
};
