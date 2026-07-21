import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
import { ShoppingBag, Plus, Minus, X, Loader2, ArrowRight, Truck, ShieldCheck, Sparkles } from "lucide-react";
import { FadeRise, Stagger, AmbientGlow } from "@/components/motion";

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
  hoodies: "Hoodies", "t-shirts": "T-shirts", tops: "Crop tops", bottoms: "Bottoms", accessories: "Accessories",
};

const HERO_CHIPS = ["Free UK delivery over £50", "Studio-ready", "Limited drops", "Crew colours"];

const TRUST_POINTS = [
  { Icon: Truck, tile: "bg-primary/10 text-primary", t: "Fast UK delivery", c: "Dispatched within 3 working days, tracked to your door." },
  { Icon: ShieldCheck, tile: "bg-success/10 text-success", t: "Secure checkout", c: "Card payments handled securely by Stripe. We never store your details." },
  { Icon: Sparkles, tile: "bg-accent/10 text-accent", t: "Studio quality", c: "Heavyweight fabrics that survive every rehearsal and wash." },
];

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
    const token = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;
    const environment = token?.startsWith("pk_test_") ? "sandbox" : "live";
    const { data, error } = await supabase.functions.invoke("create-merch-checkout", {
      body: { items: bag.map((b) => ({ variantId: b.variantId, quantity: b.qty })), environment, origin: window.location.origin },
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
      {/* ───────────────── Hero ───────────────── */}
      <section className="relative overflow-hidden px-4 pt-24 pb-14 md:pt-32 md:pb-20">
        <AmbientGlow variant="duo" />
        <div className="relative container max-w-7xl text-center">
          <FadeRise>
            <p className="eyebrow mb-5">Official merch</p>
            <h1 className="font-display text-5xl font-extrabold tracking-tight md:text-7xl">
              Wear the <em className="font-serif italic font-normal text-accent">Splat</em>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-xl">
              Studio-ready streetwear in the colours of the crew. Hoodies, tees, crops and more — built to move different.
            </p>
          </FadeRise>
          <FadeRise delay={140}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-2">
              {HERO_CHIPS.map((label) => (
                <span key={label} className="rounded-full bg-secondary px-4 py-1.5 text-sm font-medium text-secondary-foreground">
                  {label}
                </span>
              ))}
            </div>
          </FadeRise>
        </div>
      </section>

      {!loading && !sellingActive && (
        <div className="px-4 pb-4">
          <div className="container max-w-7xl">
            <div className="rounded-2xl bg-warning/10 px-4 py-3 text-center text-sm font-medium text-warning">
              Our shop is currently closed for orders — check back soon.
            </div>
          </div>
        </div>
      )}

      {/* ───────────────── Product grid ───────────────── */}
      <section className="px-4 py-12 md:py-16">
        <div className="container max-w-7xl">
          {/* Category filter pills */}
          <FadeRise>
            <div className="mb-10 flex flex-wrap justify-center gap-2 md:mb-12">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    cat === c
                      ? "bg-primary text-primary-foreground shadow-soft"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c === "all" ? "All" : CATEGORY_LABEL[c] ?? c}
                </button>
              ))}
            </div>
          </FadeRise>

          {loading ? (
            <div className="grid grid-cols-2 gap-4 md:gap-5 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] animate-pulse rounded-3xl bg-secondary/60" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <p className="py-20 text-center text-muted-foreground">No products in this category yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:gap-5 lg:grid-cols-4">
              {shown.map((p, i) => {
                const inStock = p.merchandise_variants.some((v) => v.is_active && v.stock_quantity > 0);
                return (
                  <FadeRise key={p.id} delay={(i % 4) * 70} className="h-full">
                    <button
                      onClick={() => openProduct(p)}
                      className="group h-full w-full rounded-3xl bg-card p-3 text-left shadow-soft transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg"
                    >
                      <div className="relative aspect-square overflow-hidden rounded-2xl bg-secondary/40">
                        <img
                          src={primaryImage(p)}
                          alt={p.name}
                          loading="lazy"
                          className="h-full w-full object-contain p-6 transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                        />
                        {!inStock && (
                          <Badge variant="secondary" className="absolute left-3 top-3">Sold out</Badge>
                        )}
                        <span className="absolute bottom-3 right-3 flex h-9 w-9 translate-y-2 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-soft transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                          <Plus className="h-4 w-4" />
                        </span>
                      </div>
                      <div className="px-2 pb-2 pt-4">
                        <p className="eyebrow">{CATEGORY_LABEL[p.category] ?? p.category}</p>
                        <h3 className="mt-1.5 font-display text-lg font-semibold leading-tight tracking-tight">{p.name}</h3>
                        <p className="mt-1 font-display font-bold tabular-nums">£{Number(p.base_price).toFixed(2)}</p>
                      </div>
                    </button>
                  </FadeRise>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ───────────────── Trust strip ───────────────── */}
      <section className="bg-secondary/40 px-4 py-16 md:py-24">
        <div className="container max-w-7xl">
          <Stagger className="grid gap-4 sm:grid-cols-3 md:gap-5" childClassName="h-full">
            {TRUST_POINTS.map(({ Icon, tile, t, c }) => (
              <Card key={t} className="h-full p-7 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tile}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold tracking-tight">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c}</p>
              </Card>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Floating bag button — hidden while shop is closed for orders */}
      {sellingActive && (
        <button
          onClick={() => setBagOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-soft-lg transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-primary/90 active:scale-95"
          aria-label="Open bag"
        >
          <ShoppingBag className="h-5 w-5" />
          Bag
          {bagCount > 0 && (
            <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-foreground px-1.5 text-xs font-bold tabular-nums text-primary">
              {bagCount}
            </span>
          )}
        </button>
      )}

      {/* ───────────────── Product dialog ───────────────── */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-secondary/40">
                <img src={primaryImage(selected)} alt={selected.name} className="h-full w-full object-contain p-6" />
              </div>
              <div className="flex flex-col">
                <DialogHeader>
                  <p className="eyebrow text-left">{CATEGORY_LABEL[selected.category] ?? selected.category}</p>
                  <DialogTitle className="text-left font-display text-2xl font-bold tracking-tight">{selected.name}</DialogTitle>
                </DialogHeader>
                <p className="mt-1 font-display text-xl font-bold tabular-nums">£{Number(selected.base_price).toFixed(2)}</p>
                {selected.description && (
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{selected.description}</p>
                )}
                {sellingActive ? (
                  <>
                    <p className="eyebrow mb-2 mt-6">Size</p>
                    <div className="inline-flex flex-wrap gap-1 self-start rounded-full bg-secondary p-1">
                      {selected.merchandise_variants.filter((v) => v.is_active).map((v) => {
                        const out = v.stock_quantity <= 0;
                        return (
                          <button
                            key={v.id}
                            disabled={out}
                            onClick={() => setSize(v.size)}
                            className={`h-9 min-w-11 rounded-full px-3 text-sm font-semibold transition-all ${
                              size === v.size
                                ? "bg-card text-foreground shadow-soft"
                                : out
                                  ? "cursor-not-allowed text-muted-foreground/40 line-through"
                                  : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {v.size}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-5 flex items-center gap-3">
                      <div className="inline-flex items-center rounded-full bg-secondary p-1">
                        <button
                          onClick={() => setQty((q) => Math.max(1, q - 1))}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground hover:shadow-soft"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center font-display font-bold tabular-nums">{qty}</span>
                        <button
                          onClick={() => setQty((q) => Math.min(20, q + 1))}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground hover:shadow-soft"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <Button onClick={addToBag} disabled={!size} size="lg" className="mt-6 w-full">
                      Add to bag · £{(Number(selected.base_price) * qty).toFixed(2)}
                    </Button>
                  </>
                ) : (
                  <Button disabled size="lg" className="mt-6 w-full">
                    Not currently available to order
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ───────────────── Bag drawer ───────────────── */}
      <Sheet open={bagOpen} onOpenChange={setBagOpen}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ShoppingBag className="h-5 w-5" />
              </span>
              Your bag
            </SheetTitle>
          </SheetHeader>
          {bag.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <p className="text-muted-foreground">Your bag is empty.</p>
              <Button variant="secondary" onClick={() => setBagOpen(false)}>Keep shopping</Button>
            </div>
          ) : (
            <>
              <div className="-mx-1 flex-1 space-y-3 overflow-y-auto px-1 py-2">
                {bag.map((b) => (
                  <div key={b.variantId} className="flex gap-3 rounded-2xl bg-secondary/40 p-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-card shadow-soft">
                      <img src={b.image} alt={b.name} className="h-full w-full object-contain p-1.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold leading-tight">{b.name}</p>
                      <p className="text-xs text-muted-foreground">Size {b.size} · £{b.unitPrice.toFixed(2)}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="inline-flex items-center rounded-full bg-secondary">
                          <button
                            onClick={() => setItemQty(b.variantId, -1)}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-6 text-center text-sm font-semibold tabular-nums">{b.qty}</span>
                          <button
                            onClick={() => setItemQty(b.variantId, 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <button
                          onClick={() => setItemQty(b.variantId, -b.qty)}
                          className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Remove"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="font-display text-sm font-bold tabular-nums">£{(b.qty * b.unitPrice).toFixed(2)}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-3 border-t border-border/50 pt-4">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-display font-bold tabular-nums text-foreground">£{bagTotal.toFixed(2)}</span>
                </div>
                <Button onClick={checkout} disabled={checkingOut} size="lg" className="w-full">
                  {checkingOut ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirecting…</>
                  ) : (
                    <>Secure checkout <ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>
                <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" /> Secure payment via Stripe
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ───────────────── CTA ───────────────── */}
      <section className="relative overflow-hidden px-4 py-16 text-center md:py-24">
        <AmbientGlow variant="light" />
        <FadeRise className="relative mx-auto max-w-2xl">
          <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">More than merch</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Every piece is worn in the studio by the dancers who train here. Join them.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link to="/classes/children">
              Find your class <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </FadeRise>
      </section>
    </div>
  );
};

export default Shop;
