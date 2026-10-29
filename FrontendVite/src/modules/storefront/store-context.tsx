import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_THEME, ShopApiError, assetUrl, parseJson, setPreview, shopApi, type CartLine, type ShopInfo, type ShopSession, type ShopTheme,
} from "@/lib/storefront/shop.api";
import { translate, type StringKey } from "./strings";

// ── Cart ─────────────────────────────────────────────────────────────────────

/** What the cart remembers so it can be drawn instantly. The prices are never trusted: the server prices every line again. */
export interface CartItem extends CartLine {
  title: string; variantName: string | null; price: number; productSlug: string; templateId: string | null; imageId: string | null;
}

const cartKey = (slug: string) => `shop:${slug}:cart`;
const sessionKey = (slug: string) => `shop:${slug}:session`;

// Storage can be blocked (private window). The store still works; the cart just does not survive a reload.
function readStorage<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function writeStorage(key: string, value: unknown) {
  try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ }
}

// ── Theme ────────────────────────────────────────────────────────────────────

const FONTS: Record<string, { css: string; google?: string }> = {
  inter: { css: "'Inter', system-ui, sans-serif", google: "Inter:wght@400;500;600;700" },
  poppins: { css: "'Poppins', system-ui, sans-serif", google: "Poppins:wght@400;500;600;700" },
  montserrat: { css: "'Montserrat', system-ui, sans-serif", google: "Montserrat:wght@400;500;600;700" },
  playfair: { css: "'Playfair Display', Georgia, serif", google: "Playfair+Display:wght@400;600;700" },
  lora: { css: "'Lora', Georgia, serif", google: "Lora:wght@400;500;600;700" },
  cairo: { css: "'Cairo', system-ui, sans-serif", google: "Cairo:wght@400;600;700" },
  tajawal: { css: "'Tajawal', system-ui, sans-serif", google: "Tajawal:wght@400;500;700" },
  system: { css: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
};
export const FONT_CHOICES = Object.keys(FONTS);

const RADIUS: Record<ShopTheme["radius"], string> = { none: "0px", sm: "4px", md: "8px", lg: "14px", full: "9999px" };

/** A hex colour or nothing: theme values end up in a <style> block, so anything else is not allowed through. */
const safeColor = (v: unknown, fallback: string) => (typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : fallback);

export function themeCss(theme: ShopTheme): string {
  const h = FONTS[theme.headingFont] ?? FONTS.inter, b = FONTS[theme.bodyFont] ?? FONTS.inter;
  return `.sf-root{--sf-primary:${safeColor(theme.primary, DEFAULT_THEME.primary)};--sf-accent:${safeColor(theme.accent, DEFAULT_THEME.accent)};`
    + `--sf-bg:${safeColor(theme.background, DEFAULT_THEME.background)};--sf-surface:${safeColor(theme.surface, DEFAULT_THEME.surface)};`
    + `--sf-text:${safeColor(theme.text, DEFAULT_THEME.text)};--sf-muted:${safeColor(theme.muted, DEFAULT_THEME.muted)};`
    + `--sf-radius:${RADIUS[theme.radius] ?? RADIUS.md};--sf-heading:${h.css};--sf-body:${b.css};}`;
}

function useGoogleFonts(theme: ShopTheme) {
  React.useEffect(() => {
    const families = [...new Set([theme.headingFont, theme.bodyFont])].map(f => FONTS[f]?.google).filter(Boolean) as string[];
    if (!families.length) return;
    const id = "sf-fonts";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) { link = document.createElement("link"); link.id = id; link.rel = "stylesheet"; document.head.appendChild(link); }
    link.href = `https://fonts.googleapis.com/css2?${families.map(f => `family=${f}`).join("&")}&display=swap`;
  }, [theme.headingFont, theme.bodyFont]);
}

// ── Context ──────────────────────────────────────────────────────────────────

interface StoreContext {
  slug: string; basePath: string; info: ShopInfo; theme: ShopTheme; lang: "en" | "ar"; dir: "ltr" | "rtl"; preview: boolean; embedded: boolean;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
  money: (amount: number, currency?: string) => string;
  link: (path: string) => string;
  cart: CartItem[]; cartCount: number; cartOpen: boolean; setCartOpen: (open: boolean) => void;
  addToCart: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void; removeFromCart: (productId: string) => void; clearCart: () => void;
  session: ShopSession | null; setSession: (s: ShopSession | null) => void;
  discountCode: string; setDiscountCode: (c: string) => void;
}

const Ctx = React.createContext<StoreContext | null>(null);

export function useStore(): StoreContext {
  const c = React.useContext(Ctx);
  if (!c) throw new Error("useStore must be used inside <StoreProvider>");
  return c;
}

export interface StoreProviderProps {
  slug: string;
  /** "/shop/my-store" when served from a path, "" when the store has its own address. */
  basePath: string;
  children: React.ReactNode;
  /** The page builder draws the store inside the admin: links must not navigate away and the cart must not be shared. */
  embedded?: boolean;
  /** Replaces what the server sends (the builder previews unsaved theme / menu changes). */
  infoOverride?: Partial<ShopInfo>;
}

export function StoreProvider({ slug, basePath, children, embedded = false, infoOverride }: StoreProviderProps) {
  // ?preview=1 lets a signed-in owner see a store that is not open yet. Read once, before the first request goes out.
  const [preview] = React.useState(() => {
    if (embedded) return true;
    const on = new URLSearchParams(window.location.search).get("preview") === "1";
    if (on) setPreview(true);
    return on || (() => { try { return sessionStorage.getItem("storefront:preview") === "1"; } catch { return false; } })();
  });
  React.useEffect(() => { if (embedded) setPreview(true); }, [embedded]);

  const q = useQuery({
    queryKey: ["shop", slug, "info"], queryFn: () => shopApi.info(slug), staleTime: embedded ? 0 : 60_000, retry: false,
  });

  const [cart, setCart] = React.useState<CartItem[]>(() => (embedded ? [] : readStorage<CartItem[]>(cartKey(slug), [])));
  const [cartOpen, setCartOpen] = React.useState(false);
  const [session, setSessionState] = React.useState<ShopSession | null>(() => {
    if (embedded) return null;
    const s = readStorage<ShopSession | null>(sessionKey(slug), null);
    return s && new Date(s.expiresAt).getTime() > Date.now() ? s : null;
  });
  const [discountCode, setDiscountCode] = React.useState("");

  const persistCart = React.useCallback((next: CartItem[]) => { setCart(next); if (!embedded) writeStorage(cartKey(slug), next); }, [slug, embedded]);

  const addToCart = React.useCallback((item: Omit<CartItem, "quantity">, quantity = 1) => {
    const existing = cart.find(c => c.productId === item.productId);
    const next = existing
      ? cart.map(c => c.productId === item.productId ? { ...c, ...item, quantity: Math.min(999, c.quantity + quantity) } : c)
      : [...cart, { ...item, quantity: Math.min(999, quantity) }];
    persistCart(next);
  }, [cart, persistCart]);
  const setQuantity = React.useCallback((id: string, quantity: number) =>
    persistCart(quantity <= 0 ? cart.filter(c => c.productId !== id) : cart.map(c => c.productId === id ? { ...c, quantity: Math.min(999, quantity) } : c)), [cart, persistCart]);
  const removeFromCart = React.useCallback((id: string) => persistCart(cart.filter(c => c.productId !== id)), [cart, persistCart]);
  const clearCart = React.useCallback(() => persistCart([]), [persistCart]);

  const setSession = React.useCallback((s: ShopSession | null) => { setSessionState(s); if (!embedded) writeStorage(sessionKey(slug), s); }, [slug, embedded]);

  const info = React.useMemo(() => (q.data ? { ...q.data, ...infoOverride } : null), [q.data, infoOverride]);
  const theme = React.useMemo<ShopTheme>(() => ({ ...DEFAULT_THEME, ...parseJson<Partial<ShopTheme>>(info?.themeJson, {}) }), [info?.themeJson]);
  useGoogleFonts(theme);

  const lang = info?.language ?? "en";
  const value = React.useMemo<StoreContext | null>(() => {
    if (!info) return null;
    const locale = lang === "ar" ? "ar-u-nu-latn" : "en";
    return {
      slug, basePath, info, theme, lang, dir: lang === "ar" ? "rtl" : "ltr", preview, embedded,
      t: (key, vars) => translate(lang, key, vars),
      money: (amount, currency) => {
        try { return new Intl.NumberFormat(locale, { style: "currency", currency: currency ?? info.currencyCode }).format(Number.isFinite(amount) ? amount : 0); }
        catch { return `${currency ?? info.currencyCode} ${amount.toFixed(2)}`; }
      },
      link: path => (embedded ? "#" : `${basePath}${path}`),
      cart, cartCount: cart.reduce((n, c) => n + c.quantity, 0), cartOpen, setCartOpen, addToCart, setQuantity, removeFromCart, clearCart,
      session, setSession, discountCode, setDiscountCode,
    };
  }, [slug, basePath, info, theme, lang, preview, embedded, cart, cartOpen, addToCart, setQuantity, removeFromCart, clearCart, session, setSession, discountCode]);

  // Page title and icon follow the store.
  React.useEffect(() => {
    if (!info || embedded) return;
    document.documentElement.lang = lang;
    if (!document.title || document.title === "VroduxERP") document.title = info.seoTitle || info.name;
    if (info.faviconAssetId) {
      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
      link.href = assetUrl(slug, info.faviconAssetId);
    }
  }, [info, lang, slug, embedded]);

  if (q.isLoading) return <div className="min-h-[60vh] flex items-center justify-center text-sm text-slate-500">…</div>;
  if (q.error || !value) {
    const closed = q.error instanceof ShopApiError && q.error.status === 404;
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8 text-center">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{closed ? "This store is not available" : "We couldn't load this store"}</h1>
          <p className="text-sm text-slate-500 mt-2">{closed ? "It may not be open yet, or the address may be wrong." : (q.error as Error | null)?.message}</p>
        </div>
      </div>
    );
  }

  return (
    <Ctx.Provider value={value}>
      <style>{themeCss(theme) + STOREFRONT_CSS}</style>
      <div className="sf-root" dir={value.dir} style={{ fontFamily: "var(--sf-body)" }}>{children}</div>
    </Ctx.Provider>
  );
}

// ── Links and navigation ─────────────────────────────────────────────────────

/** A link inside the store. In the builder preview it does nothing, so clicking a menu item does not leave the editor. */
export function StoreLink({ to, children, className, onClick, ...rest }: { to: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const { link, embedded } = useStore();
  if (/^(https?:|mailto:|tel:)/i.test(to)) return <a href={to} className={className} onClick={onClick} {...rest}>{children}</a>;
  if (embedded) return <a href="#" className={className} onClick={e => { e.preventDefault(); onClick?.(e); }} {...rest}>{children}</a>;
  return <Link to={link(to)} className={className} onClick={onClick} {...rest}>{children}</Link>;
}

export function useStoreNavigate() {
  const { link, embedded } = useStore();
  const nav = useNavigate();
  return React.useCallback((path: string, opts?: { replace?: boolean }) => { if (!embedded) nav(link(path), opts); }, [nav, link, embedded]);
}

/** Sets the browser title and description for a page. */
export function usePageMeta(title: string | null | undefined, description?: string | null) {
  const { info, embedded } = useStore();
  React.useEffect(() => {
    if (embedded || !title) return;
    document.title = `${title} · ${info.name}`;
    let meta = document.querySelector<HTMLMetaElement>("meta[name='description']");
    if (description) {
      if (!meta) { meta = document.createElement("meta"); meta.name = "description"; document.head.appendChild(meta); }
      meta.content = description;
    }
  }, [title, description, info.name, embedded]);
}

// ── Shared styles ────────────────────────────────────────────────────────────

const STOREFRONT_CSS = `
.sf-root{background:var(--sf-bg);color:var(--sf-text);min-height:100vh;line-height:1.5;-webkit-font-smoothing:antialiased}
.sf-root *{box-sizing:border-box}
.sf-root h1,.sf-root h2,.sf-root h3,.sf-root h4{font-family:var(--sf-heading);color:var(--sf-text);line-height:1.2}
.sf-root a{color:inherit}
.sf-muted{color:var(--sf-muted)}
.sf-container{width:100%;max-width:1200px;margin:0 auto;padding-inline:16px}
@media(min-width:768px){.sf-container{padding-inline:24px}}
.sf-root .sf-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 22px;border-radius:var(--sf-radius);font-weight:600;font-size:14px;cursor:pointer;border:1px solid var(--sf-primary);background:var(--sf-primary);color:#fff;text-decoration:none;transition:opacity .15s,transform .05s;font-family:inherit}
.sf-root .sf-btn:hover{opacity:.9}.sf-root .sf-btn:active{transform:translateY(1px)}
.sf-root .sf-btn:disabled{opacity:.5;cursor:not-allowed}
.sf-root .sf-btn-accent{background:var(--sf-accent);border-color:var(--sf-accent)}
.sf-root .sf-btn-outline{background:transparent;color:var(--sf-primary)}
.sf-root .sf-btn-sm{min-height:36px;padding:0 14px;font-size:13px}
.sf-root .sf-btn-block{display:flex;width:100%}
.sf-input{width:100%;min-height:44px;padding:0 12px;border:1px solid #d1d5db;border-radius:var(--sf-radius);background:#fff;color:#111827;font-size:15px;font-family:inherit}
.sf-input:focus{outline:2px solid var(--sf-accent);outline-offset:-1px;border-color:var(--sf-accent)}
textarea.sf-input{padding:10px 12px;min-height:80px}
select.sf-input{appearance:auto}
.sf-label{display:block;font-size:13px;font-weight:600;margin-bottom:6px}
.sf-card{background:var(--sf-bg);border-radius:var(--sf-radius)}
.sf-card-bordered{border:1px solid #e5e7eb}
.sf-card-shadow{box-shadow:0 1px 3px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.08)}
.sf-box{border:1px solid #e5e7eb;border-radius:var(--sf-radius);background:var(--sf-bg)}
.sf-img{display:block;width:100%;height:100%;object-fit:cover;background:var(--sf-surface)}
.sf-prose{white-space:pre-line}.sf-prose p{margin:0 0 1em}.sf-prose ul,.sf-prose ol{margin:0 0 1em;padding-inline-start:1.4em}.sf-prose ul{list-style:disc}.sf-prose ol{list-style:decimal}
.sf-prose h2,.sf-prose h3,.sf-prose h4{margin:1.2em 0 .5em;font-weight:700}.sf-prose a{color:var(--sf-accent);text-decoration:underline}
.sf-badge{display:inline-block;padding:2px 10px;border-radius:9999px;font-size:12px;font-weight:600}
`;

export { Ctx as StoreContextInternal };
