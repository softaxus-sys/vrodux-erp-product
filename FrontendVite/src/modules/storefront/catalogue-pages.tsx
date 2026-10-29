import * as React from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Check, ShoppingBag, Trash2 } from "lucide-react";
import { parseJson, shopApi, type Section, type ShopProduct, type ShopVariant } from "@/lib/storefront/shop.api";
import { StoreLink, usePageMeta, useStore, useStoreNavigate } from "./store-context";
import { Notice, PageSpinner, ProductGrid, ProductPhoto, QtyStepper, RichText, Spinner } from "./sf-ui";
import { SectionRenderer } from "./sections";
import { useQuote } from "./use-quote";

// ── Pages built in the page builder ──────────────────────────────────────────

export function NotFound() {
  const { t } = useStore();
  usePageMeta(t("notfound.title"));
  return (
    <div className="sf-container py-24 text-center">
      <h1 className="text-3xl font-bold">{t("notfound.title")}</h1>
      <p className="sf-muted mt-3">{t("notfound.text")}</p>
      <StoreLink to="/" className="sf-btn mt-6">{t("notfound.home")}</StoreLink>
    </div>
  );
}

export function CmsPage({ pageSlug }: { pageSlug?: string }) {
  const params = useParams();
  const slug = pageSlug ?? params.pageSlug ?? "home";
  const { slug: shop, info } = useStore();
  const q = useQuery({ queryKey: ["shop", shop, "page", slug], queryFn: () => shopApi.page(shop, slug), retry: false, staleTime: 30_000 });
  usePageMeta(q.data ? (slug === "home" ? (q.data.seoTitle || info.seoTitle || info.name) : (q.data.seoTitle || q.data.title)) : null, q.data?.metaDescription ?? (slug === "home" ? info.metaDescription : null));

  if (q.isLoading) return <PageSpinner />;
  if (q.error || !q.data) return <NotFound />;
  const sections = parseJson<Section[]>(q.data.sectionsJson, []);
  const plain = q.data.kind === "policy" || q.data.kind === "page";
  return (
    <>
      {plain && sections.length === 0 && <div className="sf-container py-12"><h1 className="text-3xl font-bold">{q.data.title}</h1></div>}
      <SectionRenderer sections={sections} />
    </>
  );
}

// ── Product listing / collection ─────────────────────────────────────────────

const SORTS = ["newest", "name", "price_asc", "price_desc"] as const;

export function ProductsPage({ collectionMode = false }: { collectionMode?: boolean }) {
  const { slug, t } = useStore();
  const params = useParams();
  const [sp, setSp] = useSearchParams();
  const collection = collectionMode ? params.collectionSlug : undefined;
  const q = sp.get("q") ?? "", category = sp.get("category") ?? "", sort = sp.get("sort") ?? "newest";

  const cats = useQuery({ queryKey: ["shop", slug, "categories"], queryFn: () => shopApi.categories(slug), staleTime: 60_000 });
  const cols = useQuery({ queryKey: ["shop", slug, "collections"], queryFn: () => shopApi.collections(slug), staleTime: 60_000, enabled: collectionMode });
  const list = useInfiniteQuery({
    queryKey: ["shop", slug, "products", q, category, sort, collection],
    queryFn: ({ pageParam }) => shopApi.products(slug, { q, category, collection, sort, page: pageParam, pageSize: 24 }),
    initialPageParam: 1,
    getNextPageParam: last => (last.page < last.totalPages ? last.page + 1 : undefined),
    staleTime: 30_000,
  });
  const items = React.useMemo(() => list.data?.pages.flatMap(pg => pg.items) ?? [], [list.data]);

  const title = collectionMode ? (cols.data?.find(c => c.slug === collection)?.name ?? "") : q ? `“${q}”` : category || t("products.title");
  usePageMeta(title || t("products.title"));
  const setParam = (k: string, v: string) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); setSp(n, { replace: true }); };
  const total = list.data?.pages[0]?.totalCount ?? 0, shown = items.length;

  return (
    <div className="sf-container py-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{title}</h1>
          {collectionMode && cols.data?.find(c => c.slug === collection)?.description && <p className="sf-muted mt-1">{cols.data.find(c => c.slug === collection)!.description}</p>}
          <p className="text-sm sf-muted mt-1">{t("products.results", { count: total })}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm sf-muted" htmlFor="sf-sort">{t("products.sort")}</label>
          <select id="sf-sort" className="sf-input !w-auto" value={sort} onChange={e => setParam("sort", e.target.value === "newest" ? "" : e.target.value)}>
            {SORTS.map(s => <option key={s} value={s}>{t(`sort.${s}` as never)}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        {!collectionMode && (cats.data?.length ?? 0) > 0 && (
          <aside aria-label={t("products.categories")}>
            <p className="font-semibold mb-2 text-sm">{t("products.categories")}</p>
            <ul className="flex flex-wrap lg:flex-col gap-2 lg:gap-1 text-sm">
              <li><button className={`px-3 py-1.5 rounded-full lg:rounded-md ${!category ? "font-semibold bg-slate-100" : "sf-muted"}`} onClick={() => setParam("category", "")}>{t("products.allCategories")}</button></li>
              {cats.data!.map(c => (
                <li key={c.name}><button className={`px-3 py-1.5 rounded-full lg:rounded-md text-start ${category === c.name ? "font-semibold bg-slate-100" : "sf-muted"}`} onClick={() => setParam("category", c.name)}>{c.name} <span className="text-xs">({c.count})</span></button></li>
              ))}
            </ul>
          </aside>
        )}
        <div className={collectionMode || (cats.data?.length ?? 0) === 0 ? "lg:col-span-2" : ""}>
          {list.isLoading ? <PageSpinner />
            : list.error ? <Notice kind="error">{(list.error as Error).message}</Notice>
            : shown === 0 ? (
              <div className="text-center py-16">
                <p className="sf-muted">{t("products.empty")}</p>
                {(q || category) && <button className="sf-btn sf-btn-outline mt-4" onClick={() => setSp(new URLSearchParams(), { replace: true })}>{t("products.clear")}</button>}
              </div>
            ) : (
              <>
                <ProductGrid products={items} />
                {list.hasNextPage && (
                  <div className="text-center mt-8"><button className="sf-btn sf-btn-outline" disabled={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
                    {list.isFetchingNextPage && <Spinner className="h-4 w-4" />}{t("products.loadMore")}
                  </button></div>
                )}
              </>
            )}
        </div>
      </div>
    </div>
  );
}

// ── Product page ─────────────────────────────────────────────────────────────

/** The variant that matches every chosen option (null while a choice is missing). */
function pickVariant(p: ShopProduct, chosen: Record<string, string>): ShopVariant | null {
  if (p.options.length === 0) return p.variants[0] ?? null;
  if (p.options.some(o => !chosen[o.name])) return null;
  return p.variants.find(v => p.options.every(o => v.options[o.name] === chosen[o.name])) ?? null;
}

/** Whether a value can still lead to an in-stock variant given the other choices already made. */
function valueAvailable(p: ShopProduct, optionName: string, value: string, chosen: Record<string, string>): boolean {
  return p.variants.some(v => v.inStock && v.options[optionName] === value
    && p.options.every(o => o.name === optionName || !chosen[o.name] || v.options[o.name] === chosen[o.name]));
}

export function ProductPage() {
  const { productSlug = "" } = useParams();
  const { slug, t, money, addToCart, setCartOpen, info } = useStore();
  const q = useQuery({ queryKey: ["shop", slug, "product", productSlug], queryFn: () => shopApi.product(slug, productSlug), retry: false, staleTime: 30_000 });
  const p = q.data;

  const [chosen, setChosen] = React.useState<Record<string, string>>({});
  const [qty, setQty] = React.useState(1);
  const [imageIdx, setImageIdx] = React.useState(0);
  const [added, setAdded] = React.useState(false);

  // Start on the first in-stock combination so the page opens ready to buy.
  React.useEffect(() => {
    if (!p) return;
    const first = p.variants.find(v => v.inStock) ?? p.variants[0];
    setChosen(first ? { ...first.options } : {}); setQty(1); setImageIdx(0); setAdded(false);
  }, [p?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  usePageMeta(p ? (p.seoTitle || p.name) : null, p?.metaDescription ?? p?.shortDescription);

  const variant = p ? pickVariant(p, chosen) : null;
  // A variant may have its own photos; fall back to the listing's.
  const images = React.useMemo(() => {
    if (!p) return [];
    const own = variant ? p.images.filter(i => i.productId === variant.productId) : [];
    return own.length ? own : p.images.filter(i => !i.productId);
  }, [p, variant]);
  React.useEffect(() => setImageIdx(0), [variant?.productId]);

  if (q.isLoading) return <PageSpinner />;
  if (q.error || !p) return <NotFound />;

  const prices = p.variants.map(v => v.price);
  const canBuy = !!variant && variant.inStock;
  const maxQty = variant?.remaining ?? undefined;

  const add = () => {
    if (!variant) return;
    const img = images[0] ?? p.images[0];
    addToCart({
      productId: variant.productId, title: p.name, variantName: p.options.length ? p.options.map(o => chosen[o.name]).join(" / ") : null,
      price: variant.price, productSlug: p.slug, templateId: p.id, imageId: img?.id ?? null,
    }, qty);
    setAdded(true); setCartOpen(true);
  };

  const jsonLd = {
    "@context": "https://schema.org", "@type": "Product", name: p.name, description: p.shortDescription ?? undefined, sku: variant?.sku ?? undefined,
    offers: { "@type": "AggregateOffer", lowPrice: Math.min(...prices), highPrice: Math.max(...prices), priceCurrency: info.currencyCode },
  };

  return (
    <div className="sf-container py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
        <div>
          <div className="aspect-square overflow-hidden" style={{ borderRadius: "var(--sf-radius)", background: "var(--sf-surface)" }}>
            <ProductPhoto templateId={p.id} imageId={images[imageIdx]?.id ?? null} alt={images[imageIdx]?.alt || p.name} className="!object-contain" />
          </div>
          {images.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {images.map((im, i) => (
                <button key={im.id} onClick={() => setImageIdx(i)} aria-label={`${p.name} ${i + 1}`}
                  className={`aspect-square overflow-hidden border-2 ${i === imageIdx ? "border-[var(--sf-accent)]" : "border-transparent"}`} style={{ borderRadius: "var(--sf-radius)" }}>
                  <ProductPhoto templateId={p.id} imageId={im.id} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          {p.brandName && <p className="text-sm sf-muted">{p.brandName}</p>}
          <h1 className="text-2xl md:text-3xl font-bold">{p.name}</h1>
          <p className="text-2xl font-semibold mt-3">
            {variant ? money(variant.price) : Math.min(...prices) === Math.max(...prices) ? money(prices[0] ?? 0) : `${t("common.from")} ${money(Math.min(...prices))}`}
          </p>
          {p.shortDescription && <p className="sf-muted mt-3">{p.shortDescription}</p>}

          {p.options.map(o => (
            <fieldset key={o.name} className="mt-5">
              <legend className="sf-label">{o.name}{chosen[o.name] ? `: ${chosen[o.name]}` : ""}</legend>
              <div className="flex flex-wrap gap-2">
                {o.values.map(v => {
                  const sel = chosen[o.name] === v, ok = valueAvailable(p, o.name, v, chosen);
                  return (
                    <button key={v} type="button" onClick={() => setChosen(c => ({ ...c, [o.name]: v }))} aria-pressed={sel}
                      className={`min-h-[40px] px-4 text-sm border ${sel ? "border-[var(--sf-primary)] bg-[var(--sf-primary)] text-white" : "border-slate-300 bg-white"} ${ok ? "" : "opacity-40 line-through"}`}
                      style={{ borderRadius: "var(--sf-radius)" }}>{v}</button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <div className="mt-4 text-sm">
            {variant == null ? <span className="text-red-600">{t("product.unavailable")}</span>
              : !variant.inStock ? <span className="text-red-600 font-medium">{t("product.outOfStock")}</span>
              : variant.remaining ? <span className="text-amber-700 font-medium">{t("product.onlyLeft", { count: variant.remaining })}</span>
              : <span className="text-green-700 font-medium">{t("product.inStock")}</span>}
            {variant?.sku && <span className="sf-muted ms-3">{t("product.sku")}: {variant.sku}</span>}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <QtyStepper value={qty} onChange={setQty} max={maxQty} />
            <button className="sf-btn sf-btn-accent flex-1 sm:flex-none sm:min-w-[220px]" disabled={!canBuy} onClick={add}>
              <ShoppingBag className="h-4 w-4" />{canBuy ? t("product.add") : t("product.outOfStock")}
            </button>
          </div>
          {added && <p className="mt-3 text-sm text-green-700 flex items-center gap-1.5"><Check className="h-4 w-4" />{t("product.added")}</p>}

          <div className="mt-8"><RichText text={p.description} /></div>
        </div>
      </div>

      {p.related.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold mb-5">{t("product.related")}</h2>
          <ProductGrid products={p.related} columns={4} />
        </section>
      )}
    </div>
  );
}

// ── Cart page ────────────────────────────────────────────────────────────────

export function DiscountBox() {
  const { t, discountCode, setDiscountCode } = useStore();
  const [draft, setDraft] = React.useState(discountCode);
  const quote = useQuote({});
  const err = quote.data?.discountError;
  return (
    <div>
      <label className="sf-label" htmlFor="sf-code">{t("cart.code")}</label>
      <div className="flex gap-2">
        <input id="sf-code" className="sf-input" value={draft} placeholder={t("cart.codePlaceholder")} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter") setDiscountCode(draft.trim()); }} />
        <button type="button" className="sf-btn sf-btn-outline" onClick={() => setDiscountCode(draft.trim())}>{t("common.apply")}</button>
      </div>
      {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
      {quote.data?.discountCode && !err && <p className="text-xs text-green-700 mt-1 flex items-center gap-1"><Check className="h-3.5 w-3.5" />{quote.data.discountCode}</p>}
    </div>
  );
}

export function CartPage() {
  const { t, money, cart, setQuantity, removeFromCart } = useStore();
  const quote = useQuote({});
  const go = useStoreNavigate();
  usePageMeta(t("cart.title"));
  const q = quote.data;

  if (cart.length === 0)
    return (
      <div className="sf-container py-24 text-center">
        <ShoppingBag className="h-12 w-12 mx-auto sf-muted" />
        <h1 className="text-2xl font-bold mt-4">{t("cart.empty")}</h1>
        <StoreLink to="/products" className="sf-btn mt-6">{t("cart.continue")}</StoreLink>
      </div>
    );

  return (
    <div className="sf-container py-8">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">{t("cart.title")}</h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <ul className="divide-y divide-slate-200 border-y border-slate-200">
          {cart.map(item => {
            const line = q?.lines.find(l => l.productId === item.productId);
            return (
              <li key={item.productId} className="flex gap-4 py-5">
                <div className="h-24 w-24 shrink-0 overflow-hidden" style={{ borderRadius: "var(--sf-radius)" }}>
                  {item.templateId && <ProductPhoto templateId={item.templateId} imageId={item.imageId} alt={item.title} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-3">
                    <div>
                      <StoreLink to={`/products/${item.productSlug}`} className="font-semibold no-underline">{item.title}</StoreLink>
                      {item.variantName && <p className="text-sm sf-muted">{item.variantName}</p>}
                      <p className="text-sm mt-1">{money(line?.unitPrice ?? item.price)}</p>
                    </div>
                    <p className="font-semibold">{line && !line.problem ? money(line.lineTotal) : ""}</p>
                  </div>
                  {line?.problem && <p className="text-sm text-red-600 mt-1">{line.problem}</p>}
                  <div className="mt-3 flex items-center gap-4">
                    <QtyStepper value={item.quantity} onChange={n => setQuantity(item.productId, n)} max={line?.maxQuantity || undefined} />
                    <button className="text-sm sf-muted inline-flex items-center gap-1 hover:text-red-600" onClick={() => removeFromCart(item.productId)}><Trash2 className="h-4 w-4" />{t("common.remove")}</button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <aside className="sf-box p-5 h-fit space-y-4">
          <DiscountBox />
          <dl className="text-sm space-y-2">
            <div className="flex justify-between"><dt className="sf-muted">{t("cart.subtotal")}</dt><dd>{q ? money(q.subtotal) : "—"}</dd></div>
            {q && q.discountTotal > 0 && <div className="flex justify-between text-green-700"><dt>{t("cart.discount")}</dt><dd>−{money(q.discountTotal)}</dd></div>}
            <p className="text-xs sf-muted">{t("cart.shippingAtCheckout")}</p>
          </dl>
          {q?.blockedReason && q.lines.some(l => l.problem) && <Notice kind="error">{t("cart.problems")}</Notice>}
          <button className="sf-btn sf-btn-block" disabled={!q?.canCheckout} onClick={() => go("/checkout")}>{quote.isFetching ? <Spinner className="h-4 w-4" /> : null}{t("cart.checkout")}</button>
          <StoreLink to="/products" className="block text-center text-sm underline sf-muted">{t("cart.continue")}</StoreLink>
        </aside>
      </div>
    </div>
  );
}
