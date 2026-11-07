import * as React from "react";
import { Loader2, Minus, Plus, ImageOff } from "lucide-react";
import { assetUrl, productImageUrl, type ShopCard } from "@/lib/storefront/shop.api";
import { COUNTRIES } from "@/lib/onboarding/geo-data";
import { StoreLink, useStore } from "./store-context";

// ── Safe HTML ────────────────────────────────────────────────────────────────

const ALLOWED_TAGS = new Set(["P", "BR", "B", "STRONG", "I", "EM", "U", "UL", "OL", "LI", "H2", "H3", "H4", "A", "SPAN", "BLOCKQUOTE", "TABLE", "THEAD", "TBODY", "TR", "TD", "TH"]);

const safeHref = (href: string) => /^(https?:|mailto:|tel:|\/|#)/i.test(href.trim());

/**
 * A product description is typed by the store's staff, but it ends up in every shopper's browser. Rebuild it from an allow-list
 * of plain formatting tags (no scripts, styles, event handlers or images) rather than inserting it as it was written.
 */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const out = document.createElement("div");
  const walk = (src: Node, dst: Node) => {
    src.childNodes.forEach(n => {
      if (n.nodeType === Node.TEXT_NODE) { dst.appendChild(document.createTextNode(n.textContent ?? "")); return; }
      if (n.nodeType !== Node.ELEMENT_NODE) return;
      const el = n as HTMLElement;
      if (el.tagName === "SCRIPT" || el.tagName === "STYLE" || el.tagName === "IFRAME" || el.tagName === "OBJECT") return;   // code is dropped with its contents, not shown as text
      if (!ALLOWED_TAGS.has(el.tagName)) { walk(el, dst); return; }   // other unknown tag: keep its text, drop the tag
      const copy = document.createElement(el.tagName.toLowerCase());
      if (el.tagName === "A") {
        const href = el.getAttribute("href") ?? "";
        if (safeHref(href)) { copy.setAttribute("href", href); copy.setAttribute("rel", "noopener noreferrer nofollow"); copy.setAttribute("target", "_blank"); }
      }
      walk(el, copy);
      dst.appendChild(copy);
    });
  };
  walk(doc.body, out);
  return out.innerHTML;
}

const looksLikeHtml = (s: string) => /<\/?[a-z][\s\S]*>/i.test(s);

/** Plain text (blank line = new paragraph) or simple HTML, rendered safely. */
export function RichText({ text, className }: { text: string | null | undefined; className?: string }) {
  const html = React.useMemo(() => {
    if (!text) return "";
    if (looksLikeHtml(text)) return sanitizeHtml(text);
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return text.split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  }, [text]);
  if (!html) return null;
  return <div className={`sf-prose ${className ?? ""}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

// ── Pictures ─────────────────────────────────────────────────────────────────

export function ProductPhoto({ templateId, imageId, alt, className }: { templateId: string; imageId: string | null; alt: string; className?: string }) {
  const { slug } = useStore();
  if (!imageId) return <div className={`flex items-center justify-center bg-[var(--sf-surface)] text-slate-300 ${className ?? ""}`}><ImageOff className="h-8 w-8" /></div>;
  return <img src={productImageUrl(slug, templateId, imageId)} alt={alt} loading="lazy" className={`sf-img ${className ?? ""}`} />;
}

export function AssetPhoto({ assetId, url, alt, className }: { assetId?: string | null; url?: string | null; alt: string; className?: string }) {
  const { slug } = useStore();
  const src = assetId ? assetUrl(slug, assetId) : url;
  if (!src) return null;
  return <img src={src} alt={alt} loading="lazy" className={`sf-img ${className ?? ""}`} />;
}

// ── Product card ─────────────────────────────────────────────────────────────

export function Price({ from, to }: { from: number; to: number }) {
  const { money, t } = useStore();
  return from === to
    ? <span>{money(from)}</span>
    : <span>{t("common.from")} {money(from)}</span>;
}

export function ProductCard({ p }: { p: ShopCard }) {
  const { t, theme } = useStore();
  const cardClass = theme.cardStyle === "bordered" ? "sf-card sf-card-bordered" : theme.cardStyle === "shadow" ? "sf-card sf-card-shadow" : "sf-card";
  return (
    <StoreLink to={`/products/${p.slug}`} className={`group block overflow-hidden no-underline ${cardClass}`}>
      <div className="relative aspect-square overflow-hidden" style={{ borderRadius: "var(--sf-radius)" }}>
        <ProductPhoto templateId={p.id} imageId={p.coverImageId} alt={p.name} className="transition-transform duration-300 group-hover:scale-105" />
        {!p.inStock && <span className="sf-badge absolute top-2 start-2 bg-white text-slate-700 shadow">{t("product.outOfStock")}</span>}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold leading-snug line-clamp-2" style={{ fontFamily: "var(--sf-body)" }}>{p.name}</h3>
        <p className="text-sm mt-1 sf-muted"><Price from={p.priceFrom} to={p.priceTo} /></p>
      </div>
    </StoreLink>
  );
}

export function ProductGrid({ products, columns }: { products: ShopCard[]; columns?: number }) {
  const { theme } = useStore();
  const cols = Math.min(5, Math.max(2, columns ?? theme.productColumns ?? 4));
  const lg = { 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5" }[cols];
  return <div className={`grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 ${lg}`}>{products.map(p => <ProductCard key={p.id} p={p} />)}</div>;
}

// ── Small controls ───────────────────────────────────────────────────────────

export function Spinner({ className }: { className?: string }) { return <Loader2 className={`h-5 w-5 animate-spin ${className ?? ""}`} />; }

export function PageSpinner() { return <div className="flex justify-center py-24 sf-muted"><Spinner className="h-7 w-7" /></div>; }

export function QtyStepper({ value, onChange, max }: { value: number; onChange: (n: number) => void; max?: number | null }) {
  const { t } = useStore();
  const cap = max ?? 999;
  return (
    <div className="inline-flex items-center sf-box" style={{ minHeight: 40 }} role="group" aria-label={t("product.quantity")}>
      <button type="button" className="h-10 w-10 flex items-center justify-center disabled:opacity-40" disabled={value <= 1} onClick={() => onChange(value - 1)} aria-label="−"><Minus className="h-4 w-4" /></button>
      <input value={value} inputMode="numeric" aria-label={t("product.quantity")} className="w-10 text-center bg-transparent text-sm font-semibold focus:outline-none"
        onChange={e => { const n = parseInt(e.target.value.replace(/\D/g, ""), 10); if (Number.isFinite(n)) onChange(Math.min(cap, Math.max(1, n))); }} />
      <button type="button" className="h-10 w-10 flex items-center justify-center disabled:opacity-40" disabled={value >= cap} onClick={() => onChange(value + 1)} aria-label="+"><Plus className="h-4 w-4" /></button>
    </div>
  );
}

export function FormField({ label, children, hint, error }: { label: string; children: React.ReactNode; hint?: string; error?: string | null }) {
  return (
    <div>
      <label className="sf-label">{label}</label>
      {children}
      {hint && !error && <p className="text-xs sf-muted mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-600 mt-1" role="alert">{error}</p>}
    </div>
  );
}

export function Notice({ kind = "info", children }: { kind?: "info" | "error" | "success"; children: React.ReactNode }) {
  const style = { info: "bg-blue-50 text-blue-800 border-blue-200", error: "bg-red-50 text-red-800 border-red-200", success: "bg-green-50 text-green-800 border-green-200" }[kind];
  return <div className={`rounded-[var(--sf-radius)] border px-4 py-3 text-sm ${style}`} role={kind === "error" ? "alert" : undefined}>{children}</div>;
}

/** ISO country codes with names in the store's language. */
export const COUNTRY_CODES: string[] = COUNTRIES.map(c => c.code);

export function useCountryNames() {
  const { lang } = useStore();
  return React.useMemo(() => {
    let dn: Intl.DisplayNames | null = null;
    try { dn = new Intl.DisplayNames([lang === "ar" ? "ar" : "en"], { type: "region" }); } catch { /* old browser: show codes */ }
    return (code: string) => dn?.of(code) ?? code;
  }, [lang]);
}
