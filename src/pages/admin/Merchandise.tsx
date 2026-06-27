import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Image, Package, X, Upload } from "lucide-react";

const CATEGORIES = [
  { value: "t-shirt", label: "T-Shirt" },
  { value: "hoodie", label: "Hoodie" },
  { value: "jumper", label: "Jumper" },
  { value: "dance-pants", label: "Dance Pants" },
  { value: "bag", label: "Bag" },
  { value: "water-bottle", label: "Water Bottle" },
  { value: "baseball-cap", label: "Baseball Cap" },
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

  if (loading) return <div className="p-4 md:p-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-heading)' }}>Merchandise</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage products, stock levels, and bundles</p>
        </div>
        <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${sellingActive ? "border-primary/40 bg-primary/5" : "border-amber-500/40 bg-amber-500/5"}`}>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <Label htmlFor="merch-selling-active" className="text-sm font-semibold cursor-pointer">Uniform sales active</Label>
              <Badge variant={sellingActive ? "default" : "secondary"} className="text-[10px] uppercase tracking-wide">{sellingActive ? "Open" : "Closed"}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-[16rem]">
              {sellingActive ? "Customers can order from the public shop." : "Shop is visible but ordering is disabled."}
            </p>
          </div>
          <Switch id="merch-selling-active" checked={sellingActive} disabled={savingSelling} onCheckedChange={toggleSellingActive} />
        </div>
      </div>

      <Tabs defaultValue="items" className="space-y-4">
        <TabsList>
          <TabsTrigger value="items">Products</TabsTrigger>
          <TabsTrigger value="bundles">Bundles</TabsTrigger>
        </TabsList>

        {/* ─── Products Tab ──────────────────────── */}
        <TabsContent value="items" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openItemDialog()} size="sm"><Plus className="w-4 h-4 mr-1" /> Add Product</Button>
          </div>

          {items.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No merchandise items yet. Add your first product above.</CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.map(item => (
                <Card key={item.id} className={!item.is_active ? "opacity-60" : ""}>
                  {primaryImages[item.id] && (
                    <div className="aspect-[4/3] overflow-hidden rounded-t-lg">
                      <img src={getStorageUrl(primaryImages[item.id])} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{item.name}</CardTitle>
                        <div className="flex gap-1.5 mt-1">
                          <Badge variant="secondary" className="text-xs">{getCategoryLabel(item.category)}</Badge>
                          {!item.is_active && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                        </div>
                      </div>
                      <p className="text-lg font-bold text-primary">£{item.base_price.toFixed(2)}</p>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {item.description && <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
                    <div className="flex flex-wrap gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => openMedia(item)}><Image className="w-3.5 h-3.5 mr-1" /> Gallery</Button>
                      <Button variant="outline" size="sm" onClick={() => openVariants(item)}><Package className="w-3.5 h-3.5 mr-1" /> Sizes & Stock</Button>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Switch checked={item.is_active} onCheckedChange={() => toggleItemActive(item)} />
                        <span className="text-xs text-muted-foreground">{item.is_active ? "Active" : "Inactive"}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openItemDialog(item)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteItem(item.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Bundles Tab ───────────────────────── */}
        <TabsContent value="bundles" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openBundleDialog()} size="sm"><Plus className="w-4 h-4 mr-1" /> Create Bundle</Button>
          </div>

          {bundles.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No bundles yet. Create a bundle to offer discounted product combinations.</CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {bundles.map(bundle => {
                const biList = allBundleItems[bundle.id] || [];
                const totalValue = biList.reduce((sum, bi) => {
                  const item = items.find(i => i.id === bi.item_id);
                  return sum + (item ? item.base_price * bi.quantity : 0);
                }, 0);
                const savings = totalValue - bundle.bundle_price;

                return (
                <Card key={bundle.id} className={!bundle.is_active ? "opacity-60" : ""}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{bundle.name}</CardTitle>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">£{bundle.bundle_price.toFixed(2)}</p>
                        {totalValue > 0 && <p className="text-xs text-muted-foreground line-through">£{totalValue.toFixed(2)}</p>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {bundle.description && <p className="text-xs text-muted-foreground line-clamp-2">{bundle.description}</p>}

                    {/* Included items showcase */}
                    {biList.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Included items</p>
                        <div className="border rounded-md divide-y">
                          {biList.map(bi => {
                            const item = items.find(i => i.id === bi.item_id);
                            if (!item) return null;
                            const imgPath = primaryImages[item.id];
                            return (
                              <div key={bi.id} className="flex items-center gap-3 px-3 py-2">
                                {imgPath ? (
                                  <img src={getStorageUrl(imgPath)} alt={item.name} className="w-10 h-10 rounded object-cover flex-shrink-0" />
                                ) : (
                                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                    <Package className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{item.name}</p>
                                  <p className="text-xs text-muted-foreground">{getCategoryLabel(item.category)}{bi.quantity > 1 ? ` × ${bi.quantity}` : ''}</p>
                                </div>
                                <p className="text-sm text-muted-foreground">£{(item.base_price * bi.quantity).toFixed(2)}</p>
                              </div>
                            );
                          })}
                        </div>
                        {savings > 0 && (
                          <div className="flex items-center justify-between px-3 py-2 rounded-md bg-accent">
                            <span className="text-xs font-semibold text-accent-foreground">You save</span>
                            <span className="text-sm font-bold text-accent-foreground">£{savings.toFixed(2)} ({Math.round((savings / totalValue) * 100)}% off)</span>
                          </div>
                        )}
                      </div>
                    )}

                    <Button variant="outline" size="sm" className="w-full" onClick={() => openBundleItems(bundle)}>
                      <Package className="w-3.5 h-3.5 mr-1" /> Manage Items
                    </Button>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openBundleDialog(bundle)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteBundle(bundle.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Item Dialog ─────────────────────────── */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingItem ? "Edit Product" : "Add Product"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Dance T-Shirt" /></div>
            <div><Label>Category</Label>
              <Select value={itemForm.category} onValueChange={v => setItemForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Base Price (£)</Label><Input type="number" step="0.01" value={itemForm.base_price} onChange={e => setItemForm(f => ({ ...f, base_price: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
            <Button onClick={saveItem} className="w-full">{editingItem ? "Update" : "Create"} Product</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Variants Dialog ─────────────────────── */}
      <Dialog open={variantDialogOpen} onOpenChange={setVariantDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Sizes & Stock — {selectedItemForVariants?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Add variant form */}
            <div className="grid grid-cols-5 gap-2 items-end">
              <div>
                <Label className="text-xs">Size</Label>
                <Select value={variantForm.size} onValueChange={v => setVariantForm(f => ({ ...f, size: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Size" /></SelectTrigger>
                  <SelectContent>{COMMON_SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Colour</Label><Input className="h-9" value={variantForm.color} onChange={e => setVariantForm(f => ({ ...f, color: e.target.value }))} placeholder="Optional" /></div>
              <div><Label className="text-xs">Price Override</Label><Input className="h-9" type="number" step="0.01" value={variantForm.price_override} onChange={e => setVariantForm(f => ({ ...f, price_override: e.target.value }))} placeholder="Base" /></div>
              <div><Label className="text-xs">Stock</Label><Input className="h-9" type="number" value={variantForm.stock_quantity} onChange={e => setVariantForm(f => ({ ...f, stock_quantity: e.target.value }))} /></div>
              <Button size="sm" className="h-9" onClick={addVariant}><Plus className="w-3.5 h-3.5" /></Button>
            </div>

            {/* Variant list */}
            {variants.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No sizes added yet</p>
            ) : (
              <div className="border rounded-md divide-y">
                {variants.map(v => (
                  <div key={v.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">{v.size}</Badge>
                      {v.color && <span className="text-muted-foreground">{v.color}</span>}
                      <span className="font-medium">£{(v.price_override ?? selectedItemForVariants?.base_price ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Stock:</Label>
                      <Input type="number" className="h-8 w-20" value={v.stock_quantity} onChange={e => updateStock(v, parseInt(e.target.value) || 0)} />
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteVariant(v.id)}><X className="w-3.5 h-3.5" /></Button>
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
              <Label htmlFor="merch-upload" className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-md border border-dashed border-primary/40 text-sm hover:bg-accent transition-colors">
                <Upload className="w-4 h-4" /> {uploading ? "Uploading..." : "Upload Images"}
              </Label>
              <input id="merch-upload" type="file" accept="image/*,video/*" multiple className="hidden" onChange={uploadMedia} disabled={uploading} />
            </div>

            {media.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No images yet</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {media.map(m => (
                  <div key={m.id} className="relative group rounded-md overflow-hidden border">
                    {m.media_type === "video" ? (
                      <video src={getStorageUrl(m.file_path)} className="w-full aspect-square object-cover" />
                    ) : (
                      <img src={getStorageUrl(m.file_path)} alt="" className="w-full aspect-square object-cover" />
                    )}
                    {m.is_primary && <Badge className="absolute top-1 left-1 text-[10px]">Primary</Badge>}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      {!m.is_primary && (
                        <Button size="sm" variant="secondary" className="text-xs h-7" onClick={() => setPrimaryImage(m.id)}>Set Primary</Button>
                      )}
                      <Button size="sm" variant="destructive" className="text-xs h-7" onClick={() => deleteMedia(m)}><Trash2 className="w-3 h-3" /></Button>
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
          <DialogHeader><DialogTitle>{editingBundle ? "Edit Bundle" : "Create Bundle"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Bundle Name</Label><Input value={bundleForm.name} onChange={e => setBundleForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Starter Pack" /></div>
            <div><Label>Bundle Price (£)</Label><Input type="number" step="0.01" value={bundleForm.bundle_price} onChange={e => setBundleForm(f => ({ ...f, bundle_price: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea value={bundleForm.description} onChange={e => setBundleForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
            <Button onClick={saveBundle} className="w-full">{editingBundle ? "Update" : "Create"} Bundle</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Bundle Items Dialog ─────────────────── */}
      <Dialog open={bundleItemsDialogOpen} onOpenChange={setBundleItemsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Bundle Items — {selectedBundle?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Current items in bundle */}
            {bundleItems.length > 0 && (
              <div className="border rounded-md divide-y">
                {bundleItems.map(bi => {
                  const item = items.find(i => i.id === bi.item_id);
                  return (
                    <div key={bi.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium">{item?.name || "Unknown"}</span>
                        <span className="text-muted-foreground ml-2">×{bi.quantity}</span>
                        <span className="text-muted-foreground ml-2">£{((item?.base_price || 0) * bi.quantity).toFixed(2)}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItemFromBundle(bi.id)}><X className="w-3.5 h-3.5" /></Button>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between px-3 py-2 text-sm bg-muted/50">
                  <span className="text-muted-foreground">Items total value</span>
                  <span className="font-bold">£{getTotalItemsValue().toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2 text-sm bg-primary/5">
                  <span className="font-medium text-primary">Bundle price</span>
                  <span className="font-bold text-primary">£{selectedBundle?.bundle_price.toFixed(2)}</span>
                </div>
                {getTotalItemsValue() > (selectedBundle?.bundle_price || 0) && (
                  <div className="flex items-center justify-between px-3 py-2 text-sm bg-green-50 dark:bg-green-900/10">
                    <span className="text-green-700 dark:text-green-400 font-medium">Customer saves</span>
                    <span className="font-bold text-green-700 dark:text-green-400">£{(getTotalItemsValue() - (selectedBundle?.bundle_price || 0)).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Add items */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Add products to bundle</Label>
              <div className="space-y-1">
                {items.filter(i => i.is_active).map(item => (
                  <button key={item.id} onClick={() => addItemToBundle(item.id)} className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors text-left">
                    <span>{item.name}</span>
                    <span className="text-muted-foreground">£{item.base_price.toFixed(2)}</span>
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
