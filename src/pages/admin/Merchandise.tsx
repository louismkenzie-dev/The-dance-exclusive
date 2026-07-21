import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { FadeRise } from "@/components/motion";
import { Plus, Pencil, Trash2, Image, Package, X, Upload, Boxes, Loader2 } from "lucide-react";

const CATEGORIES = [
  { value: "t-shirt", label: "T-shirt" },
  { value: "hoodie", label: "Hoodie" },
  { value: "jumper", label: "Jumper" },
  { value: "dance-pants", label: "Dance pants" },
  { value: "bag", label: "Bag" },
  { value: "water-bottle", label: "Water bottle" },
  { value: "baseball-cap", label: "Baseball cap" },
  { value: "accessories", label: "Accessories" },
  { value: "other", label: "Other" },
];

const COMMON_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "Age 3-4", "Age 5-6", "Age 7-8", "Age 9-10", "Age 11-12", "One Size"];

type MerchItem = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  base_price: number;
  is_active: boolean;
  display_order: number;
};

type MerchVariant = {
  id: string;
  item_id: string;
  size: string;
  color: string | null;
  sku: string | null;
  price_override: number | null;
  stock_quantity: number;
  is_active: boolean;
};

type MerchMedia = {
  id: string;
  item_id: string;
  media_type: string;
  file_path: string;
  caption: string | null;
  sort_order: number | null;
  is_primary: boolean;
};

type MerchBundle = {
  id: string;
  name: string;
  description: string | null;
  bundle_price: number;
  is_active: boolean;
  display_order: number;
};

type BundleItem = {
  id: string;
  bundle_id: string;
  item_id: string;
  quantity: number;
};

const MERCH_SELLING_KEY = "merch_selling_active";

const Merchandise = () => {
  const [items, setItems] = useState<MerchItem[]>([]);
  const [bundles, setBundles] = useState<MerchBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [primaryImages, setPrimaryImages] = useState<Record<string, string>>({});

  // Global "uniform sales active" toggle (app_settings KV)
  const [sellingActive, setSellingActive] = useState(true);
  const [savingSelling, setSavingSelling] = useState(false);

  // Item form
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MerchItem | null>(null);
  const [itemForm, setItemForm] = useState({ name: "", category: "other", description: "", base_price: "" });

  // Variant management
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [selectedItemForVariants, setSelectedItemForVariants] = useState<MerchItem | null>(null);
  const [variants, setVariants] = useState<MerchVariant[]>([]);
  const [variantForm, setVariantForm] = useState({ size: "", color: "", sku: "", price_override: "", stock_quantity: "0" });

  // Media management
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [selectedItemForMedia, setSelectedItemForMedia] = useState<MerchItem | null>(null);
  const [media, setMedia] = useState<MerchMedia[]>([]);
  const [uploading, setUploading] = useState(false);

  // Bundle form
  const [bundleDialogOpen, setBundleDialogOpen] = useState(false);
  const [editingBundle, setEditingBundle] = useState<MerchBundle | null>(null);
  const [bundleForm, setBundleForm] = useState({ name: "", description: "", bundle_price: "" });
  const [bundleItems, setBundleItems] = useState<BundleItem[]>([]);
  const [bundleItemsDialogOpen, setBundleItemsDialogOpen] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState<MerchBundle | null>(null);
  const [allBundleItems, setAllBundleItems] = useState<Record<string, BundleItem[]>>({});

  useEffect(() => { fetchItems(); fetchBundles(); fetchSellingActive(); }, []);

  const fetchSellingActive = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", MERCH_SELLING_KEY)
      .maybeSingle();
    // Missing setting is treated as ON (true)
    setSellingActive(data?.value !== "false");
  };

  const toggleSellingActive = async (next: boolean) => {
    setSavingSelling(true);
    const previous = sellingActive;
    setSellingActive(next);
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        { key: MERCH_SELLING_KEY, value: next ? "true" : "false", description: "Whether uniform/merch sales are currently active on the public shop" },
        { onConflict: "key" }
      );
    setSavingSelling(false);
    if (error) {
      setSellingActive(previous);
      return toast({ title: "Couldn't update sales status", description: error.message, variant: "destructive" });
    }
    toast({ title: next ? "Uniform sales active" : "Uniform sales paused", description: next ? "Customers can order from the shop." : "Products stay visible but ordering is disabled." });
  };

  const fetchItems = async () => {
    const { data } = await supabase.from("merchandise_items").select("*").order("display_order");
    if (data) setItems(data);
    // Fetch primary images for all items
    const { data: mediaData } = await supabase.from("merchandise_media").select("*").eq("is_primary", true);
    if (mediaData) {
      const imgMap: Record<string, string> = {};
      mediaData.forEach(m => { imgMap[m.item_id] = m.file_path; });
      setPrimaryImages(imgMap);
    }
    setLoading(false);
  };

  const fetchBundles = async () => {
    const { data } = await supabase.from("merchandise_bundles").select("*").order("display_order");
    if (data) setBundles(data);
    // Fetch all bundle items
    const { data: biData } = await supabase.from("merchandise_bundle_items").select("*");
    if (biData) {
      const map: Record<string, BundleItem[]> = {};
      biData.forEach(bi => {
        if (!map[bi.bundle_id]) map[bi.bundle_id] = [];
        map[bi.bundle_id].push(bi);
      });
      setAllBundleItems(map);
    }
  };

  const getStorageUrl = (path: string) => {
    const { data } = supabase.storage.from("merchandise-media").getPublicUrl(path);
    return data.publicUrl;
  };

  // ─── Items CRUD ─────────────────────────────────
  const openItemDialog = (item?: MerchItem) => {
    if (item) {
      setEditingItem(item);
      setItemForm({ name: item.name, category: item.category, description: item.description || "", base_price: String(item.base_price) });
    } else {
      setEditingItem(null);
      setItemForm({ name: "", category: "other", description: "", base_price: "" });
    }
    setItemDialogOpen(true);
  };

  const saveItem = async () => {
    if (!itemForm.name) return toast({ title: "Name required", variant: "destructive" });
    const payload = { name: itemForm.name, category: itemForm.category, description: itemForm.description || null, base_price: parseFloat(itemForm.base_price) || 0 };
    if (editingItem) {
      const { error } = await supabase.from("merchandise_items").update(payload).eq("id", editingItem.id);
      if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      const { error } = await supabase.from("merchandise_items").insert(payload);
      if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    toast({ title: editingItem ? "Item updated" : "Item created" });
    setItemDialogOpen(false);
    fetchItems();
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Delete this merchandise item and all its variants/media?")) return;
    await supabase.from("merchandise_items").delete().eq("id", id);
    toast({ title: "Item deleted" });
    fetchItems();
  };

  const toggleItemActive = async (item: MerchItem) => {
    await supabase.from("merchandise_items").update({ is_active: !item.is_active }).eq("id", item.id);
    fetchItems();
  };

  // ─── Variants ───────────────────────────────────
  const openVariants = async (item: MerchItem) => {
    setSelectedItemForVariants(item);
    const { data } = await supabase.from("merchandise_variants").select("*").eq("item_id", item.id).order("size");
    setVariants(data || []);
    setVariantForm({ size: "", color: "", sku: "", price_override: "", stock_quantity: "0" });
    setVariantDialogOpen(true);
  };

  const addVariant = async () => {
    if (!selectedItemForVariants || !variantForm.size) return;
    const { error } = await supabase.from("merchandise_variants").insert({
      item_id: selectedItemForVariants.id,
      size: variantForm.size,
      color: variantForm.color || null,
      sku: variantForm.sku || null,
      price_override: variantForm.price_override ? parseFloat(variantForm.price_override) : null,
      stock_quantity: parseInt(variantForm.stock_quantity) || 0,
    });
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Variant added" });
    setVariantForm({ size: "", color: "", sku: "", price_override: "", stock_quantity: "0" });
    const { data } = await supabase.from("merchandise_variants").select("*").eq("item_id", selectedItemForVariants.id).order("size");
    setVariants(data || []);
  };

  const updateStock = async (variant: MerchVariant, newQty: number) => {
    await supabase.from("merchandise_variants").update({ stock_quantity: newQty }).eq("id", variant.id);
    setVariants(prev => prev.map(v => v.id === variant.id ? { ...v, stock_quantity: newQty } : v));
  };

  const deleteVariant = async (id: string) => {
    await supabase.from("merchandise_variants").delete().eq("id", id);
    setVariants(prev => prev.filter(v => v.id !== id));
    toast({ title: "Variant deleted" });
  };

  // ─── Media ──────────────────────────────────────
  const openMedia = async (item: MerchItem) => {
    setSelectedItemForMedia(item);
    const { data } = await supabase.from("merchandise_media").select("*").eq("item_id", item.id).order("sort_order");
    setMedia(data || []);
    setMediaDialogOpen(true);
  };

  const uploadMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedItemForMedia || !e.target.files?.length) return;
    setUploading(true);
    for (const file of Array.from(e.target.files)) {
      const ext = file.name.split(".").pop();
      const path = `items/${selectedItemForMedia.id}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("merchandise-media").upload(path, file);
      if (uploadError) { toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" }); continue; }
      await supabase.from("merchandise_media").insert({
        item_id: selectedItemForMedia.id,
        media_type: file.type.startsWith("video") ? "video" : "image",
        file_path: path,
        is_primary: media.length === 0,
      });
    }
    const { data } = await supabase.from("merchandise_media").select("*").eq("item_id", selectedItemForMedia.id).order("sort_order");
    setMedia(data || []);
    setUploading(false);
    toast({ title: "Media uploaded" });
  };

  const setPrimaryImage = async (mediaId: string) => {
    if (!selectedItemForMedia) return;
    await supabase.from("merchandise_media").update({ is_primary: false }).eq("item_id", selectedItemForMedia.id);
    await supabase.from("merchandise_media").update({ is_primary: true }).eq("id", mediaId);
    setMedia(prev => prev.map(m => ({ ...m, is_primary: m.id === mediaId })));
  };

  const deleteMedia = async (m: MerchMedia) => {
    await supabase.storage.from("merchandise-media").remove([m.file_path]);
    await supabase.from("merchandise_media").delete().eq("id", m.id);
    setMedia(prev => prev.filter(x => x.id !== m.id));
    toast({ title: "Media deleted" });
  };

  // ─── Bundles CRUD ───────────────────────────────
  const openBundleDialog = (bundle?: MerchBundle) => {
    if (bundle) {
      setEditingBundle(bundle);
      setBundleForm({ name: bundle.name, description: bundle.description || "", bundle_price: String(bundle.bundle_price) });
    } else {
      setEditingBundle(null);
      setBundleForm({ name: "", description: "", bundle_price: "" });
    }
    setBundleDialogOpen(true);
  };

  const saveBundle = async () => {
    if (!bundleForm.name) return toast({ title: "Name required", variant: "destructive" });
    const payload = { name: bundleForm.name, description: bundleForm.description || null, bundle_price: parseFloat(bundleForm.bundle_price) || 0 };
    if (editingBundle) {
      await supabase.from("merchandise_bundles").update(payload).eq("id", editingBundle.id);
    } else {
      await supabase.from("merchandise_bundles").insert(payload);
    }
    toast({ title: editingBundle ? "Bundle updated" : "Bundle created" });
    setBundleDialogOpen(false);
    fetchBundles();
  };

  const deleteBundle = async (id: string) => {
    if (!confirm("Delete this bundle?")) return;
    await supabase.from("merchandise_bundles").delete().eq("id", id);
    toast({ title: "Bundle deleted" });
    fetchBundles();
  };

  // ─── Bundle Items ───────────────────────────────
  const openBundleItems = async (bundle: MerchBundle) => {
    setSelectedBundle(bundle);
    const { data } = await supabase.from("merchandise_bundle_items").select("*").eq("bundle_id", bundle.id);
    setBundleItems(data || []);
    setBundleItemsDialogOpen(true);
  };

  const addItemToBundle = async (itemId: string) => {
    if (!selectedBundle) return;
    const existing = bundleItems.find(bi => bi.item_id === itemId);
    if (existing) {
      await supabase.from("merchandise_bundle_items").update({ quantity: existing.quantity + 1 }).eq("id", existing.id);
    } else {
      await supabase.from("merchandise_bundle_items").insert({ bundle_id: selectedBundle.id, item_id: itemId });
    }
    const { data } = await supabase.from("merchandise_bundle_items").select("*").eq("bundle_id", selectedBundle.id);
    setBundleItems(data || []);
    fetchBundles();
  };

  const removeItemFromBundle = async (biId: string) => {
    await supabase.from("merchandise_bundle_items").delete().eq("id", biId);
    setBundleItems(prev => prev.filter(bi => bi.id !== biId));
    fetchBundles();
  };

  const getTotalItemsValue = () => {
    return bundleItems.reduce((sum, bi) => {
      const item = items.find(i => i.id === bi.item_id);
      return sum + (item ? item.base_price * bi.quantity : 0);
    }, 0);
  };

  const getCategoryLabel = (val: string) => CATEGORIES.find(c => c.value === val)?.label || val;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 py-24 text-muted-foreground md:p-8">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <FadeRise>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Merchandise</h1>
            <p className="mt-1 text-muted-foreground">Manage products, stock levels, and bundles</p>
          </div>
          <div className="flex items-center gap-4 rounded-2xl bg-card px-5 py-4 shadow-soft">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <Label htmlFor="merch-selling-active" className="cursor-pointer text-sm font-semibold">Uniform sales active</Label>
                <Badge variant={sellingActive ? "success" : "warning"}>{sellingActive ? "Open" : "Closed"}</Badge>
              </div>
              <p className="mt-0.5 max-w-[16rem] text-xs text-muted-foreground">
                {sellingActive ? "Customers can order from the public shop." : "Shop is visible but ordering is disabled."}
              </p>
            </div>
            <Switch id="merch-selling-active" checked={sellingActive} disabled={savingSelling} onCheckedChange={toggleSellingActive} />
          </div>
        </div>
      </FadeRise>

      <Tabs defaultValue="items" className="space-y-4">
        <FadeRise delay={80}>
          <TabsList>
            <TabsTrigger value="items">Products</TabsTrigger>
            <TabsTrigger value="bundles">Bundles</TabsTrigger>
          </TabsList>
        </FadeRise>

        {/* ─── Products Tab ──────────────────────── */}
        <TabsContent value="items" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openItemDialog()} size="sm"><Plus className="mr-1.5 h-4 w-4" /> Add product</Button>
          </div>

          {items.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                  <Package className="h-6 w-6" />
                </div>
                <p className="text-muted-foreground">No merchandise items yet. Add your first product above.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-3">
              {items.map((item, i) => (
                <FadeRise key={item.id} delay={(i % 3) * 70} className="h-full">
                  <Card className={`flex h-full flex-col p-3 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg ${!item.is_active ? "opacity-60" : ""}`}>
                    <div className="relative aspect-square overflow-hidden rounded-2xl bg-secondary/40">
                      {primaryImages[item.id] ? (
                        <img src={getStorageUrl(primaryImages[item.id])} alt={item.name} loading="lazy" className="h-full w-full object-contain p-6" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
                          <Package className="h-10 w-10" />
                        </div>
                      )}
                      {!item.is_active && (
                        <Badge variant="secondary" className="absolute left-3 top-3">Inactive</Badge>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col px-2 pb-2 pt-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="eyebrow">{getCategoryLabel(item.category)}</p>
                          <h3 className="mt-1 font-display text-lg font-semibold leading-tight tracking-tight">{item.name}</h3>
                        </div>
                        <p className="font-display text-lg font-bold tabular-nums">£{item.base_price.toFixed(2)}</p>
                      </div>
                      {item.description && <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{item.description}</p>}

                      <div className="mb-3 mt-3 flex flex-wrap gap-1.5">
                        <Button variant="secondary" size="sm" onClick={() => openMedia(item)}><Image className="mr-1.5 h-3.5 w-3.5" /> Gallery</Button>
                        <Button variant="secondary" size="sm" onClick={() => openVariants(item)}><Package className="mr-1.5 h-3.5 w-3.5" /> Sizes & stock</Button>
                      </div>

                      <div className="mt-auto flex items-center justify-between border-t border-border/50 pt-3">
                        <div className="flex items-center gap-2">
                          <Switch checked={item.is_active} onCheckedChange={() => toggleItemActive(item)} />
                          <span className="text-xs text-muted-foreground">{item.is_active ? "Active" : "Inactive"}</span>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openItemDialog(item)} aria-label="Edit product"><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteItem(item.id)} aria-label="Delete product"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </FadeRise>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Bundles Tab ───────────────────────── */}
        <TabsContent value="bundles" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openBundleDialog()} size="sm"><Plus className="mr-1.5 h-4 w-4" /> Create bundle</Button>
          </div>

          {bundles.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <Boxes className="h-6 w-6" />
                </div>
                <p className="text-muted-foreground">No bundles yet. Create a bundle to offer discounted product combinations.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-3">
              {bundles.map((bundle, i) => {
                const biList = allBundleItems[bundle.id] || [];
                const totalValue = biList.reduce((sum, bi) => {
                  const item = items.find(it => it.id === bi.item_id);
                  return sum + (item ? item.base_price * bi.quantity : 0);
                }, 0);
                const savings = totalValue - bundle.bundle_price;

                return (
                  <FadeRise key={bundle.id} delay={(i % 3) * 70} className="h-full">
                    <Card className={`flex h-full flex-col p-5 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg ${!bundle.is_active ? "opacity-60" : ""}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                            <Boxes className="h-5 w-5" />
                          </div>
                          <h3 className="font-display text-lg font-semibold leading-tight tracking-tight">{bundle.name}</h3>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-lg font-bold tabular-nums">£{bundle.bundle_price.toFixed(2)}</p>
                          {totalValue > 0 && <p className="text-xs text-muted-foreground line-through tabular-nums">£{totalValue.toFixed(2)}</p>}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-1 flex-col space-y-3">
                        {bundle.description && <p className="text-xs text-muted-foreground line-clamp-2">{bundle.description}</p>}

                        {/* Included items showcase */}
                        {biList.length > 0 && (
                          <div className="space-y-2">
                            <p className="eyebrow">Included items</p>
                            <div className="overflow-hidden rounded-2xl bg-secondary/40 divide-y divide-border/50">
                              {biList.map(bi => {
                                const item = items.find(it => it.id === bi.item_id);
                                if (!item) return null;
                                const imgPath = primaryImages[item.id];
                                return (
                                  <div key={bi.id} className="flex items-center gap-3 px-3 py-2">
                                    {imgPath ? (
                                      <img src={getStorageUrl(imgPath)} alt={item.name} className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
                                    ) : (
                                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-card shadow-soft">
                                        <Package className="h-4 w-4 text-muted-foreground" />
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-medium">{item.name}</p>
                                      <p className="text-xs text-muted-foreground">{getCategoryLabel(item.category)}{bi.quantity > 1 ? ` × ${bi.quantity}` : ''}</p>
                                    </div>
                                    <p className="text-sm text-muted-foreground tabular-nums">£{(item.base_price * bi.quantity).toFixed(2)}</p>
                                  </div>
                                );
                              })}
                            </div>
                            {savings > 0 && (
                              <div className="flex items-center justify-between rounded-xl bg-success/10 px-3 py-2">
                                <span className="text-xs font-semibold text-success">You save</span>
                                <span className="text-sm font-bold text-success tabular-nums">£{savings.toFixed(2)} ({Math.round((savings / totalValue) * 100)}% off)</span>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="mt-auto space-y-3 pt-1">
                          <Button variant="secondary" size="sm" className="w-full" onClick={() => openBundleItems(bundle)}>
                            <Package className="mr-1.5 h-3.5 w-3.5" /> Manage items
                          </Button>
                          <div className="flex items-center justify-between border-t border-border/50 pt-3">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openBundleDialog(bundle)} aria-label="Edit bundle"><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteBundle(bundle.id)} aria-label="Delete bundle"><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </FadeRise>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Item Dialog ─────────────────────────── */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingItem ? "Edit product" : "Add product"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2"><Label>Name</Label><Input value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Dance T-shirt" /></div>
            <div className="grid gap-2"><Label>Category</Label>
              <Select value={itemForm.category} onValueChange={v => setItemForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>Base price (£)</Label><Input type="number" step="0.01" value={itemForm.base_price} onChange={e => setItemForm(f => ({ ...f, base_price: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Description</Label><Textarea value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
            <Button onClick={saveItem} className="w-full">{editingItem ? "Update product" : "Create product"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Variants Dialog ─────────────────────── */}
      <Dialog open={variantDialogOpen} onOpenChange={setVariantDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Sizes & stock — {selectedItemForVariants?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Add variant form */}
            <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-5">
              <div className="grid gap-1.5">
                <Label className="text-xs">Size</Label>
                <Select value={variantForm.size} onValueChange={v => setVariantForm(f => ({ ...f, size: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Size" /></SelectTrigger>
                  <SelectContent>{COMMON_SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5"><Label className="text-xs">Colour</Label><Input className="h-9" value={variantForm.color} onChange={e => setVariantForm(f => ({ ...f, color: e.target.value }))} placeholder="Optional" /></div>
              <div className="grid gap-1.5"><Label className="text-xs">Price override</Label><Input className="h-9" type="number" step="0.01" value={variantForm.price_override} onChange={e => setVariantForm(f => ({ ...f, price_override: e.target.value }))} placeholder="Base" /></div>
              <div className="grid gap-1.5"><Label className="text-xs">Stock</Label><Input className="h-9" type="number" value={variantForm.stock_quantity} onChange={e => setVariantForm(f => ({ ...f, stock_quantity: e.target.value }))} /></div>
              <Button size="sm" className="h-9" onClick={addVariant} aria-label="Add size"><Plus className="h-3.5 w-3.5" /></Button>
            </div>

            {/* Variant list */}
            {variants.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No sizes added yet</p>
            ) : (
              <div className="overflow-hidden rounded-2xl bg-secondary/40 divide-y divide-border/50">
                {variants.map(v => (
                  <div key={v.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">{v.size}</Badge>
                      {v.color && <span className="text-muted-foreground">{v.color}</span>}
                      <span className="font-medium tabular-nums">£{(v.price_override ?? selectedItemForVariants?.base_price ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Stock:</Label>
                      <Input type="number" className="h-8 w-20 rounded-xl" value={v.stock_quantity} onChange={e => updateStock(v, parseInt(e.target.value) || 0)} />
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteVariant(v.id)} aria-label="Delete size"><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Media Dialog ────────────────────────── */}
      <Dialog open={mediaDialogOpen} onOpenChange={setMediaDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Gallery — {selectedItemForMedia?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="merch-upload" className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary/60">
                <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : "Upload images"}
              </Label>
              <input id="merch-upload" type="file" accept="image/*,video/*" multiple className="hidden" onChange={uploadMedia} disabled={uploading} />
            </div>

            {media.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No images yet</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {media.map(m => (
                  <div key={m.id} className="group relative overflow-hidden rounded-2xl bg-secondary/40 shadow-soft">
                    {m.media_type === "video" ? (
                      <video src={getStorageUrl(m.file_path)} className="aspect-square w-full object-cover" />
                    ) : (
                      <img src={getStorageUrl(m.file_path)} alt="" className="aspect-square w-full object-cover" />
                    )}
                    {m.is_primary && <Badge variant="solid" className="absolute left-2 top-2">Primary</Badge>}
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      {!m.is_primary && (
                        <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setPrimaryImage(m.id)}>Set primary</Button>
                      )}
                      <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => deleteMedia(m)} aria-label="Delete media"><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Bundle Dialog ───────────────────────── */}
      <Dialog open={bundleDialogOpen} onOpenChange={setBundleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingBundle ? "Edit bundle" : "Create bundle"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2"><Label>Bundle name</Label><Input value={bundleForm.name} onChange={e => setBundleForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Starter pack" /></div>
            <div className="grid gap-2"><Label>Bundle price (£)</Label><Input type="number" step="0.01" value={bundleForm.bundle_price} onChange={e => setBundleForm(f => ({ ...f, bundle_price: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Description</Label><Textarea value={bundleForm.description} onChange={e => setBundleForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
            <Button onClick={saveBundle} className="w-full">{editingBundle ? "Update bundle" : "Create bundle"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Bundle Items Dialog ─────────────────── */}
      <Dialog open={bundleItemsDialogOpen} onOpenChange={setBundleItemsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Bundle items — {selectedBundle?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Current items in bundle */}
            {bundleItems.length > 0 && (
              <div className="overflow-hidden rounded-2xl bg-secondary/40 divide-y divide-border/50">
                {bundleItems.map(bi => {
                  const item = items.find(it => it.id === bi.item_id);
                  return (
                    <div key={bi.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium">{item?.name || "Unknown"}</span>
                        <span className="ml-2 text-muted-foreground">×{bi.quantity}</span>
                        <span className="ml-2 text-muted-foreground tabular-nums">£{((item?.base_price || 0) * bi.quantity).toFixed(2)}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItemFromBundle(bi.id)} aria-label="Remove from bundle"><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between bg-secondary/60 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Items total value</span>
                  <span className="font-bold tabular-nums">£{getTotalItemsValue().toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between bg-primary/8 px-3 py-2 text-sm">
                  <span className="font-medium text-primary">Bundle price</span>
                  <span className="font-bold text-primary tabular-nums">£{selectedBundle?.bundle_price.toFixed(2)}</span>
                </div>
                {getTotalItemsValue() > (selectedBundle?.bundle_price || 0) && (
                  <div className="flex items-center justify-between bg-success/10 px-3 py-2 text-sm">
                    <span className="font-medium text-success">Customer saves</span>
                    <span className="font-bold text-success tabular-nums">£{(getTotalItemsValue() - (selectedBundle?.bundle_price || 0)).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Add items */}
            <div>
              <Label className="mb-2 block text-sm font-medium">Add products to bundle</Label>
              <div className="space-y-1">
                {items.filter(it => it.is_active).map(item => (
                  <button key={item.id} onClick={() => addItemToBundle(item.id)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-secondary/60">
                    <span>{item.name}</span>
                    <span className="text-muted-foreground tabular-nums">£{item.base_price.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Merchandise;
