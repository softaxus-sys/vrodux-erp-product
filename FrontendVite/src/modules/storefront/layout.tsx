import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Facebook, Instagram, Menu, MessageCircle, Search, ShoppingBag, User, X, Youtube } from "lucide-react";
import { parseJson, type MenuItem, type Social } from "@/lib/storefront/shop.api";
import { StoreLink, useStore } from "./store-context";
import { AssetPhoto, ProductPhoto, QtyStepper, Spinner } from "./sf-ui";
import { safeLink } from "./sections";
import { useQuote } from "./use-quote";

// ── Header ───────────────────────────────────────────────────────────────────

function Logo() {
  const { info } = useStore();
  return (
    <StoreLink to="/" className="flex items-center gap-2 no-underline shrink-0" aria-label={info.name}>
      {info.logoAssetId
        ? <AssetPhoto assetId={info.logoAssetId} alt={info.name} className="!h-9 !w-auto object-contain bg-transparent" />
        : <span className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--sf-heading)" }}>{info.name}</span>}
    </StoreLink>
  );
}

function HeaderSearch({ onDone }: { onDone?: () => void }) {
  const { t, link, embedded } = useStore();
  const nav = useNavigate();
  const [q, setQ] = React.useState("");
  return (
    <form className="relative" role="search" onSubmit={e => { e.preventDefault(); if (embedded || !q.trim()) return; nav(`${link("/products")}?q=${encodeURIComponent(q.trim())}`); setQ(""); onDone?.(); }}>
      <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 sf-muted pointer-events-none" />
      <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("search.placeholder")} aria-label={t("nav.search")} className="sf-input !ps-9 !min-h-[40px]" />
    </form>
  );
}

export function StoreHeader() {
  const { info, theme, t, cartCount, setCartOpen, session, preview, embedded } = useStore();
  const [open, setOpen] = React.useState(false);
  const menu = parseJson<MenuItem[]>(info.headerMenuJson, []);
  const center = theme.headerStyle === "center";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200" style={{ background: "var(--sf-bg)" }}>
      {preview && !embedded && <div className="bg-amber-100 text-amber-900 text-xs text-center py-1.5 font-medium">{t("preview.banner")}</div>}
      {info.announcementText && (
        <div className="text-center text-xs py-2 px-3 font-medium" style={{ background: "var(--sf-primary)", color: "#fff" }}>{info.announcementText}</div>
      )}
      <div className="sf-container flex items-center gap-4 h-16">
        <button className="md:hidden p-2 -ms-2" onClick={() => setOpen(true)} aria-label={t("nav.menu")}><Menu className="h-5 w-5" /></button>
        <div className={center ? "md:flex-1 md:flex md:justify-center md:order-2" : ""}><Logo /></div>
        <nav className={`hidden md:flex items-center gap-6 ${center ? "md:order-1 md:flex-1" : "ms-6"}`} aria-label={t("nav.menu")}>
          {menu.map((m, i) => safeLink(m.url) && <StoreLink key={i} to={safeLink(m.url)!} className="text-sm font-medium no-underline hover:opacity-70">{m.label}</StoreLink>)}
        </nav>
        <div className={`flex items-center gap-1 ${center ? "md:order-3 md:flex-1 md:justify-end" : "ms-auto"}`}>
          <div className="hidden lg:block w-56 me-2"><HeaderSearch /></div>
          <StoreLink to="/account" className="p-2 rounded-full hover:bg-slate-100" aria-label={t("nav.account")} title={session ? session.customer.firstName : t("nav.account")}>
            <User className="h-5 w-5" />
          </StoreLink>
          <button className="relative p-2 rounded-full hover:bg-slate-100" onClick={() => setCartOpen(true)} aria-label={t("nav.cart")}>
            <ShoppingBag className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -end-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white" style={{ background: "var(--sf-accent)" }}>{cartCount}</span>
            )}
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 start-0 w-72 max-w-[85vw] p-5 overflow-y-auto" style={{ background: "var(--sf-bg)" }}>
            <div className="flex items-center justify-between mb-5">
              <Logo />
              <button onClick={() => setOpen(false)} aria-label={t("nav.close")}><X className="h-5 w-5" /></button>
            </div>
            <HeaderSearch onDone={() => setOpen(false)} />
            <nav className="mt-5 flex flex-col">
              {menu.map((m, i) => safeLink(m.url) && (
                <StoreLink key={i} to={safeLink(m.url)!} onClick={() => setOpen(false)} className="py-3 border-b border-slate-100 text-base font-medium no-underline">{m.label}</StoreLink>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}

// ── Cart drawer ──────────────────────────────────────────────────────────────

export function CartDrawer() {
  const { t, money, cart, cartOpen, setCartOpen, setQuantity, removeFromCart, embedded } = useStore();
  const quote = useQuote({ enabled: cartOpen });
  if (!cartOpen || embedded) return null;
  const q = quote.data;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={() => setCartOpen(false)} />
      <aside className="absolute inset-y-0 end-0 w-full max-w-md flex flex-col shadow-2xl" style={{ background: "var(--sf-bg)" }} role="dialog" aria-label={t("cart.title")}>
        <div className="flex items-center justify-between px-5 h-16 border-b border-slate-200">
          <h2 className="text-lg font-bold">{t("cart.title")}</h2>
          <button onClick={() => setCartOpen(false)} aria-label={t("nav.close")}><X className="h-5 w-5" /></button>
        </div>

        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <ShoppingBag className="h-10 w-10 sf-muted" />
            <p className="sf-muted">{t("cart.empty")}</p>
            <StoreLink to="/products" className="sf-btn" onClick={() => setCartOpen(false)}>{t("cart.continue")}</StoreLink>
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto divide-y divide-slate-100 px-5">
              {cart.map(item => {
                const line = q?.lines.find(l => l.productId === item.productId);
                return (
                  <li key={item.productId} className="flex gap-3 py-4">
                    <div className="h-20 w-20 shrink-0 overflow-hidden" style={{ borderRadius: "var(--sf-radius)" }}>
                      {item.templateId && <ProductPhoto templateId={item.templateId} imageId={item.imageId} alt={item.title} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <StoreLink to={`/products/${item.productSlug}`} onClick={() => setCartOpen(false)} className="text-sm font-semibold no-underline line-clamp-2">{item.title}</StoreLink>
                      {item.variantName && <p className="text-xs sf-muted">{item.variantName}</p>}
                      <p className="text-sm mt-1">{money(line?.unitPrice ?? item.price)}</p>
                      {line?.problem && <p className="text-xs text-red-600 mt-1">{line.problem}</p>}
                      <div className="mt-2 flex items-center gap-3">
                        <QtyStepper value={item.quantity} onChange={n => setQuantity(item.productId, n)} max={line?.maxQuantity || undefined} />
                        <button className="text-xs underline sf-muted" onClick={() => removeFromCart(item.productId)}>{t("common.remove")}</button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-slate-200 p-5 space-y-3">
              <div className="flex justify-between font-semibold">
                <span>{t("cart.subtotal")}</span>
                <span className="flex items-center gap-2">{quote.isFetching && <Spinner className="h-3.5 w-3.5" />}{q ? money(q.subtotal) : "—"}</span>
              </div>
              <p className="text-xs sf-muted">{t("cart.shippingAtCheckout")}</p>
              {q?.blockedReason && q.lines.some(l => l.problem) && <p className="text-xs text-red-600">{t("cart.problems")}</p>}
              <StoreLink to="/cart" className="sf-btn sf-btn-outline sf-btn-block" onClick={() => setCartOpen(false)}>{t("cart.title")}</StoreLink>
              <StoreLink to="/checkout" className="sf-btn sf-btn-block" onClick={() => setCartOpen(false)}>{t("cart.checkout")}</StoreLink>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

// ── Footer ───────────────────────────────────────────────────────────────────

export function StoreFooter() {
  const { info, t } = useStore();
  const menu = parseJson<MenuItem[]>(info.footerMenuJson, []);
  const social = parseJson<Social>(info.socialJson, {});
  const socials = [
    social.instagram && { href: social.instagram, icon: Instagram, label: "Instagram" },
    social.facebook && { href: social.facebook, icon: Facebook, label: "Facebook" },
    social.youtube && { href: social.youtube, icon: Youtube, label: "YouTube" },
    social.whatsapp && { href: /^https?:/i.test(social.whatsapp) ? social.whatsapp : `https://wa.me/${social.whatsapp.replace(/\D/g, "")}`, icon: MessageCircle, label: "WhatsApp" },
    social.x && { href: social.x, icon: X, label: "X" },
  ].filter(Boolean) as { href: string; icon: React.ElementType; label: string }[];

  return (
    <footer className="mt-16 border-t border-slate-200" style={{ background: "var(--sf-surface)" }}>
      <div className="sf-container py-10 grid gap-8 md:grid-cols-3">
        <div>
          <p className="font-bold text-lg" style={{ fontFamily: "var(--sf-heading)" }}>{info.name}</p>
          {info.address && <p className="text-sm sf-muted mt-2 whitespace-pre-line">{info.address}</p>}
        </div>
        <nav aria-label="Footer">
          <ul className="space-y-2 text-sm">
            {menu.map((m, i) => safeLink(m.url) && <li key={i}><StoreLink to={safeLink(m.url)!} className="no-underline hover:underline">{m.label}</StoreLink></li>)}
          </ul>
        </nav>
        <div className="text-sm space-y-2">
          <p className="font-semibold">{t("footer.contact")}</p>
          {info.contactEmail && <p><a href={`mailto:${info.contactEmail}`} className="hover:underline">{info.contactEmail}</a></p>}
          {info.contactPhone && <p><a href={`tel:${info.contactPhone}`} className="hover:underline" dir="ltr">{info.contactPhone}</a></p>}
          {socials.length > 0 && (
            <div className="flex gap-3 pt-2">
              {socials.map(s => safeLink(s.href) && <a key={s.label} href={safeLink(s.href)!} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="hover:opacity-70"><s.icon className="h-5 w-5" /></a>)}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-slate-200 py-4 text-center text-xs sf-muted">{t("footer.rights", { year: new Date().getFullYear(), name: info.name })}</div>
    </footer>
  );
}

export function StoreShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StoreHeader />
      <main>{children}</main>
      <StoreFooter />
      <CartDrawer />
    </>
  );
}
