import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ShoppingBag, Plus, Minus, X, Check, Loader2, ArrowRight, Truck, ShieldCheck, Sparkles } from "lucide-react";
import GrainOverlay from "@/components/immersive/GrainOverlay";
import { Reveal } from "@/components/immersive/Reveal";
import { Marquee } from "@/components/immersive/Marquee";

type Variant = { id: string; size: string; stock_quantity: number; price_override: number | null; is_active: boolean };
type Media = { file_path: string; is_primary: boolean; sort_order: number | null };
type Product = {
  id: string;
  name: string;
  category: string;
  base_price: number;
  description: string | null;
  merchandise_media: Media[];
  merchandise_variants: Variant[];
};
type BagItem = { variantId: string; productId: string; name: string; size: string; image: string; unitPrice: number; qty: number };

const BAG_KEY = "tde_bag_v1";
const readBag = (): BagItem[] => {
  try { const r = localStorage.getItem(BAG_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
};
const primaryImage = (p: Product) =>
  (p.merchandise_media.find((m) => m.is_primary) ?? p.merchandise_media[0])?.file_path ?? "/placeholder.svg";

const CATEGORY_LABEL: Record<string, string> = {
  hoodies: "Hoodies", "t-shirts": "T-Shirts", tops: "Crop Tops", bottoms: "Bottoms", accessories: "Accessories",
};

const Shop = () => {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<string>("all");
  const [selected, setSelected] = useState<Product | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [bag, setBag] = useState<BagItem[]>(() => readBag());
  const [bagOpen, setBagOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  // Global "uniform selling active" flag — products always visible, but ordering gated.
  const [sellingActive, setSellingActive] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data, error }, { data: sellingSetting }] = await Promise.all([
        supabase
          .from("merchandise_items")
          .select("id, name, category, base_price, description, merchandise_media(file_path,is_primary,sort_order), merchandise_variants(id,size,stock_quantity,price_override,is_active)")
          .eq("is_active", true)
          .order("display_order", { ascending: true }),
        supabase
          .from("app_settings")
          .select("value")
          .eq("key", "merch_selling_active")
          .maybeSingle(),
      ]);
      if (!cancelled) {
        if (error) toast({ title: "Couldn't load the shop", description: error.message, variant: "destructive" });
        setProducts(((data as Product[]) ?? []));
        // Missing setting is treated as ON (true)
        setSellingActive(sellingSetting?.value !== "false");
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  useEffect(() => { localStorage.setItem(BAG_KEY, JSON.stringify(bag)); }, [bag]);

  // Handle Stripe redirect back
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("order");
    if (p === "success") {
      toast({ title: "Order confirmed!", description: "Thanks — a receipt is on its way to your inbox." });
      setBag([]);
      window.history.replaceState({}, "", "/shop");
    } else if (p === "cancelled") {
      toast({ title: "Checkout cancelled", description: "Your bag is saved — pick up where you left off." });
      window.history.replaceState({}, "", "/shop");
    }
  }, [toast]);

  const categories = useMemo(() => ["all", ...Array.from(new Set(products.map((p) => p.category)))], [products]);
  const shown = cat === "all" ? products : products.filter((p) => p.category === cat);
  const bagCount = bag.reduce((n, b) => n + b.qty, 0);
  const bagTotal = bag.reduce((n, b) => n + b.qty * b.unitPrice, 0);

  const openProduct = (p: Product) => {
    setSelected(p);
    const firstInStock = p.merchandise_variants.find((v) => v.is_active && v.stock_quantity > 0);
    setSize(firstInStock?.size ?? p.merchandise_variants[0]?.size ?? null);
    setQty(1);
  };

  const addToBag = () => {
    if (!sellingActive || !selected || !size) return;
    const variant = selected.merchandise_variants.find((v) => v.size === size);
    if (!variant) return;
    const unitPrice = Number(variant.price_override ?? selected.base_price);
    setBag((prev) => {
      const i = prev.findIndex((b) => b.variantId === variant.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: Math.min(20, next[i].qty + qty) };
        return next;
      }
      return [...prev, { variantId: variant.id, productId: selected.id, name: selected.name, size, image: primaryImage(selected), unitPrice, qty }];
    });
    toast({ title: "Added to bag", description: `${selected.name} · ${size}` });
    setSelected(null);
    setBagOpen(true);
  };

  const setItemQty = (variantId: string, delta: number) =>
    setBag((prev) => prev.flatMap((b) => {
      if (b.variantId !== variantId) return [b];
      const q = b.qty + delta;
      return q <= 0 ? [] : [{ ...b, qty: Math.min(20, q) }];
    }));

  const checkout = async () => {
    if (!sellingActive || bag.length === 0) return;
    setCheckingOut(true);
    const { data, error } = await supabase.functions.invoke("create-merch-checkout", {
      body: { items: bag.map((b) => ({ variantId: b.variantId, quantity: b.qty })), origin: window.location.origin },
    });
    setCheckingOut(false);
    if (error || (data as any)?.error) {
      toast({ title: "Checkout unavailable", description: (data as any)?.error || "Payments are still being set up — please try again soon.", variant: "destructive" });
      return;
    }
    if ((data as any)?.url) window.location.href = (data as any).url;
  };

  return (
    <div className="bg-background text-foreground overflow-x-clip">
      {/* HERO */}
      <section className="relative min-h-[58vh] flex flex-col items-center justify-center text-center px-4 overflow-hidden">
        <div className="absolute inset-0 stage-light-mag" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_-10%,transparent,hsl(220_20%_4%)_75%)]" />
        <GrainOverlay />
        <span aria-hidden className="pointer-events-none select-none absolute inset-x-0 top-[16%] text-center font-display font-bold text-[24vw] leading-none text-stroke-faint tracking-tighter">SHOP</span>
        <div className="relative z-10 max-w-3xl animate-fade-in">
          <p className="text-accent uppercase tracking-[0.3em] text-xs font-semibold mb-5">Official Merch</p>
          <h1 className="font-display font-bold leading-[0.92] tracking-tight text-[16vw] sm:text-7xl md:text-8xl">
            <span className="block">Wear the</span>
            <span className="block text-accent drop-shadow-[0_0_40px_hsl(330_90%_55%/0.4)]">Splat</span>
          </h1>
          <p className="mt-6 text-base md:text-xl text-muted-foreground max-w-lg mx-auto" style={{ fontFamily: "var(--font-body)", textTransform: "none", letterSpacing: "normal" }}>
            Studio-ready streetwear in the colours of the crew. Hoodies, tees, crops and more — built to make you stand out.
          </p>
        </div>
      </section>

      <div className="border-y border-border bg-card/40 py-4">
        <Marquee items={["Free UK Delivery Over £50", "Studio-Ready", "Limited Drops", "Wear the Splat", "Crew Colours"]} speed={38} accent="text-accent" />
      </div>

      {!loading && !sellingActive && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center">
          <p className="text-sm text-amber-200" style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}>
            Our shop is currently closed for orders — check back soon.
          </p>
        </div>
      )}

      {/* GRID */}
      <section className="relative py-16 px-4 overflow-hidden">
        <div className="absolute inset-0 stage-light-duo opacity-30" />
        <div className="relative container">
          {/* filters */}
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-[0.15em] border transition-colors ${
                  cat === c ? "bg-accent text-white border-accent" : "border-border text-muted-foreground hover:text-foreground hover:border-accent/40"
                }`}
              >
                {c === "all" ? "All" : CATEGORY_LABEL[c] ?? c}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-2xl border border-border bg-card/40 animate-pulse" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <p className="text-center text-muted-foreground py-20" style={{ textTransform: "none" }}>No products in this category yet.</p>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              {shown.map((p, i) => {
                const inStock = p.merchandise_variants.some((v) => v.is_active && v.stock_quantity > 0);
                return (
                  <Reveal key={p.id} delay={(i % 4) * 70}>
                    <button
                      onClick={() => openProduct(p)}
                      className="group w-full text-left rounded-2xl border border-border bg-card/60 overflow-hidden transition-all duration-500 hover:-translate-y-1.5 hover:border-accent/40 hover:shadow-2xl"
                    >
                      <div className="relative aspect-square overflow-hidden bg-[radial-gradient(120%_100%_at_50%_0%,hsl(220_22%_12%),hsl(220_26%_6%))]">
                        <GrainOverlay />
                        <img src={primaryImage(p)} alt={p.name} loading="lazy" className="relative h-full w-full object-contain p-6 transition-transform duration-500 group-hover:scale-105" />
                        {!inStock && (
                          <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-background/80 border border-border text-[10px] uppercase tracking-widest text-muted-foreground">Sold out</span>
                        )}
                        <span className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-accent text-white flex items-center justify-center opacity-0 translate-y-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
                          <Plus className="w-4 h-4" />
                        </span>
                      </div>
                      <div className="p-4">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{CATEGORY_LABEL[p.category] ?? p.category}</p>
                        <h3 className="font-display text-lg leading-tight mt-1">{p.name}</h3>
                        <p className="mt-1 font-semibold text-accent">£{Number(p.base_price).toFixed(2)}</p>
                      </div>
                    </button>
                  </Reveal>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* trust strip */}
      <section className="border-t border-border py-12 px-4">
        <div className="container grid sm:grid-cols-3 gap-6 text-center">
          {[
            { Icon: Truck, t: "Fast UK Delivery", c: "Dispatched within 3 working days, tracked to your door." },
            { Icon: ShieldCheck, t: "Secure Checkout", c: "Card payments handled securely by Stripe. We never store your details." },
            { Icon: Sparkles, t: "Studio Quality", c: "Heavyweight fabrics that survive every rehearsal and wash." },
          ].map(({ Icon, t, c }) => (
            <div key={t} className="flex flex-col items-center">
              <div className="w-11 h-11 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center text-accent mb-3"><Icon className="w-5 h-5" /></div>
              <h3 className="font-display text-lg">{t}</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs" style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}>{c}</p>
            </div>
          ))}
        </div>
      </section>

      {/* floating bag button — hidden while shop is closed for orders */}
      {sellingActive && (
        <button
          onClick={() => setBagOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-5 py-3 rounded-full bg-accent text-white font-semibold uppercase tracking-wider text-sm shadow-xl shadow-accent/30 hover:bg-[hsl(330,90%,60%)] transition-colors"
          aria-label="Open bag"
        >
          <ShoppingBag className="w-5 h-5" />
          Bag
          {bagCount > 0 && <span className="ml-1 min-w-5 h-5 px-1.5 rounded-full bg-white text-accent text-xs flex items-center justify-center font-bold">{bagCount}</span>}
        </button>
      )}

      {/* PRODUCT DIALOG */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="relative aspect-square rounded-xl overflow-hidden bg-[radial-gradient(120%_100%_at_50%_0%,hsl(220_22%_12%),hsl(220_26%_6%))]">
                <GrainOverlay />
                <img src={primaryImage(selected)} alt={selected.name} className="relative h-full w-full object-contain p-6" />
              </div>
              <div className="flex flex-col">
                <DialogHeader>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground text-left">{CATEGORY_LABEL[selected.category] ?? selected.category}</p>
                  <DialogTitle className="text-2xl text-left">{selected.name}</DialogTitle>
                </DialogHeader>
                <p className="mt-1 text-xl font-semibold text-accent">£{Number(selected.base_price).toFixed(2)}</p>
                {selected.description && (
                  <p className="mt-3 text-sm text-muted-foreground" style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}>{selected.description}</p>
                )}
                {sellingActive ? (
                  <>
                    <p className="mt-5 text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">Size</p>
                    <div className="flex flex-wrap gap-2">
                      {selected.merchandise_variants.filter((v) => v.is_active).map((v) => {
                        const out = v.stock_quantity <= 0;
                        return (
                          <button
                            key={v.id}
                            disabled={out}
                            onClick={() => setSize(v.size)}
                            className={`min-w-11 px-3 h-10 rounded-lg border text-sm font-semibold transition-colors ${
                              size === v.size ? "bg-accent text-white border-accent" : out ? "border-border text-muted-foreground/40 line-through cursor-not-allowed" : "border-border text-foreground hover:border-accent/50"
                            }`}
                          >
                            {v.size}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-5 flex items-center gap-3">
                      <div className="flex items-center border border-border rounded-lg">
                        <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground"><Minus className="w-4 h-4" /></button>
                        <span className="w-8 text-center font-semibold">{qty}</span>
                        <button onClick={() => setQty((q) => Math.min(20, q + 1))} className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground"><Plus className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <Button onClick={addToBag} disabled={!size} className="mt-6 w-full font-semibold uppercase tracking-wider bg-accent text-white hover:bg-[hsl(330,90%,60%)]">
                      Add to Bag · £{(Number(selected.base_price) * qty).toFixed(2)}
                    </Button>
                  </>
                ) : (
                  <Button disabled className="mt-6 w-full font-semibold uppercase tracking-wider">
                    Not currently available to order
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* BAG DRAWER */}
      <Sheet open={bagOpen} onOpenChange={setBagOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2"><ShoppingBag className="w-5 h-5" /> Your Bag</SheetTitle>
          </SheetHeader>
          {bag.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
              <ShoppingBag className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-muted-foreground" style={{ textTransform: "none" }}>Your bag is empty.</p>
              <Button variant="outline" onClick={() => setBagOpen(false)}>Keep shopping</Button>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto -mx-1 px-1 py-2 space-y-3">
                {bag.map((b) => (
                  <div key={b.variantId} className="flex gap-3 rounded-xl border border-border bg-card/50 p-3">
                    <div className="w-16 h-16 rounded-lg bg-[radial-gradient(120%_100%_at_50%_0%,hsl(220_22%_12%),hsl(220_26%_6%))] shrink-0 overflow-hidden">
                      <img src={b.image} alt={b.name} className="w-full h-full object-contain p-1.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-sm leading-tight truncate">{b.name}</p>
                      <p className="text-xs text-muted-foreground">Size {b.size} · £{b.unitPrice.toFixed(2)}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex items-center border border-border rounded-md">
                          <button onClick={() => setItemQty(b.variantId, -1)} className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground"><Minus className="w-3 h-3" /></button>
                          <span className="w-6 text-center text-sm font-semibold">{b.qty}</span>
                          <button onClick={() => setItemQty(b.variantId, 1)} className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground"><Plus className="w-3 h-3" /></button>
                        </div>
                        <button onClick={() => setItemQty(b.variantId, -b.qty)} className="ml-auto text-muted-foreground hover:text-destructive" aria-label="Remove"><X className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <div className="font-semibold text-sm">£{(b.qty * b.unitPrice).toFixed(2)}</div>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-4 space-y-3">
                <div className="flex justify-between text-sm text-muted-foreground" style={{ textTransform: "none" }}>
                  <span>Subtotal</span><span className="text-foreground font-semibold">£{bagTotal.toFixed(2)}</span>
                </div>
                <Button onClick={checkout} disabled={checkingOut} className="w-full font-semibold uppercase tracking-wider bg-accent text-white hover:bg-[hsl(330,90%,60%)]">
                  {checkingOut ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Redirecting…</> : <>Secure Checkout <ArrowRight className="w-4 h-4 ml-2" /></>}
                </Button>
                <p className="text-[11px] text-center text-muted-foreground flex items-center justify-center gap-1.5" style={{ textTransform: "none" }}>
                  <ShieldCheck className="w-3.5 h-3.5" /> Secure payment via Stripe
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* CTA */}
      <section className="relative py-24 px-4 text-center overflow-hidden border-t border-border">
        <div className="absolute inset-0 stage-light-blue opacity-50" />
        <GrainOverlay />
        <Reveal className="relative max-w-2xl mx-auto">
          <h2 className="font-display font-bold text-4xl md:text-6xl">More Than Merch</h2>
          <p className="mt-4 text-muted-foreground text-lg" style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}>
            Every piece is worn in the studio by the dancers who train here. Join them.
          </p>
          <Button asChild size="lg" className="mt-7 px-8 py-6 font-semibold uppercase tracking-wider">
            <Link to="/classes/children"><Check className="w-4 h-4 mr-2" /> Find Your Class</Link>
          </Button>
        </Reveal>
      </section>
    </div>
  );
};

export default Shop;
