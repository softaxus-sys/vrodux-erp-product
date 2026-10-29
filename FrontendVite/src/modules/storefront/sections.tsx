import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Gift, Headset, Heart, Mail, MapPin, Phone, RefreshCw, ShieldCheck, Star, Tag, Truck, type LucideIcon } from "lucide-react";
import { shopApi, type Section } from "@/lib/storefront/shop.api";
import { StoreLink, useStore } from "./store-context";
import { AssetPhoto, ProductGrid, RichText, Spinner } from "./sf-ui";

// ── Reading a section's settings ─────────────────────────────────────────────

type Settings = Record<string, unknown>;
const str = (s: Settings, k: string, d = ""): string => (typeof s[k] === "string" ? (s[k] as string) : d);
const num = (s: Settings, k: string, d: number): number => (typeof s[k] === "number" ? (s[k] as number) : d);
const arr = <T,>(s: Settings, k: string): T[] => (Array.isArray(s[k]) ? (s[k] as T[]) : []);

/** Builder content is data that came from the store's staff, so a link in it is only followed if it is a plain web, mail or phone address or a path in the store. */
export function safeLink(url: string): string | null {
  const u = url.trim();
  if (!u) return null;
  return /^(https?:\/\/|mailto:|tel:|\/)/i.test(u) ? u : null;
}

function SectionButton({ label, url, variant = "solid" }: { label: string; url: string; variant?: "solid" | "outline" | "light" }) {
  const to = safeLink(url);
  if (!label || !to) return null;
  const cls = variant === "outline" ? "sf-btn sf-btn-outline" : variant === "light" ? "sf-btn" : "sf-btn";
  const style = variant === "light" ? { background: "#fff", color: "var(--sf-primary)", borderColor: "#fff" } : undefined;
  return <StoreLink to={to} className={cls} style={style}>{label}</StoreLink>;
}

function Wrap({ children, className = "", surface = false }: { children: React.ReactNode; className?: string; surface?: boolean }) {
  return <section className={`py-10 md:py-14 ${className}`} style={surface ? { background: "var(--sf-surface)" } : undefined}><div className="sf-container">{children}</div></section>;
}

function Heading({ text, align = "start" }: { text: string; align?: string }) {
  if (!text) return null;
  return <h2 className={`text-2xl md:text-3xl font-bold mb-6 ${align === "center" ? "text-center" : ""}`}>{text}</h2>;
}

// ── Sections ─────────────────────────────────────────────────────────────────

function Hero({ s }: { s: Settings }) {
  const hasImage = !!(str(s, "imageAssetId") || str(s, "imageUrl"));
  const heights: Record<string, number> = { sm: 300, md: 460, lg: 620 };
  const overlay = Math.min(80, Math.max(0, num(s, "overlay", 40))) / 100;
  const center = str(s, "align", "center") === "center";
  return (
    <section className="relative flex items-center overflow-hidden" style={{ minHeight: heights[str(s, "height", "md")] ?? 460, background: "var(--sf-surface)" }}>
      {hasImage && <AssetPhoto assetId={str(s, "imageAssetId") || null} url={safeLink(str(s, "imageUrl"))} alt="" className="absolute inset-0" />}
      {hasImage && <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${overlay})` }} />}
      <div className={`sf-container relative py-12 ${center ? "text-center" : ""}`}>
        <div className={center ? "mx-auto max-w-2xl" : "max-w-xl"}>
          <h1 className="text-3xl md:text-5xl font-bold" style={hasImage ? { color: "#fff" } : undefined}>{str(s, "heading")}</h1>
          {str(s, "subheading") && <p className="mt-4 text-base md:text-lg" style={{ color: hasImage ? "rgba(255,255,255,.9)" : "var(--sf-muted)" }}>{str(s, "subheading")}</p>}
          <div className={`mt-6 flex ${center ? "justify-center" : ""}`}>
            <SectionButton label={str(s, "buttonLabel")} url={str(s, "buttonUrl")} variant={hasImage ? "light" : "solid"} />
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturedProducts({ s }: { s: Settings }) {
  const { slug, t } = useStore();
  const source = str(s, "source", "all"), collection = str(s, "collection"), category = str(s, "category");
  const limit = Math.min(24, Math.max(2, num(s, "limit", 8))), sort = str(s, "sort", "newest");
  const q = useQuery({
    queryKey: ["shop", slug, "featured", source, collection, category, limit, sort],
    queryFn: () => shopApi.products(slug, { collection: source === "collection" ? collection : undefined, category: source === "category" ? category : undefined, sort, pageSize: limit }),
    staleTime: 60_000,
  });
  const viewAll = source === "collection" && collection ? `/collections/${collection}` : source === "category" && category ? `/products?category=${encodeURIComponent(category)}` : "/products";
  return (
    <Wrap>
      <div className="flex items-end justify-between gap-4 mb-6">
        <h2 className="text-2xl md:text-3xl font-bold">{str(s, "heading")}</h2>
        <StoreLink to={viewAll} className="text-sm font-semibold underline-offset-4 hover:underline" style={{ color: "var(--sf-accent)" }}>{t("section.viewAll")}</StoreLink>
      </div>
      {q.isLoading ? <div className="flex justify-center py-10"><Spinner /></div>
        : (q.data?.items.length ?? 0) === 0 ? <p className="sf-muted text-sm">{t("products.empty")}</p>
        : <ProductGrid products={q.data!.items} />}
    </Wrap>
  );
}

function CollectionList({ s }: { s: Settings }) {
  const { slug } = useStore();
  const limit = Math.min(12, Math.max(1, num(s, "limit", 6)));
  const q = useQuery({ queryKey: ["shop", slug, "collections"], queryFn: () => shopApi.collections(slug), staleTime: 60_000 });
  const items = (q.data ?? []).slice(0, limit);
  if (!q.isLoading && items.length === 0) return null;
  return (
    <Wrap surface>
      <Heading text={str(s, "heading")} />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {items.map(c => (
          <StoreLink key={c.slug} to={`/collections/${c.slug}`} className="group relative block aspect-[4/3] overflow-hidden no-underline" style={{ borderRadius: "var(--sf-radius)" }}>
            <AssetPhoto assetId={c.imageAssetId} alt={c.name} className="transition-transform duration-300 group-hover:scale-105" />
            <div className="absolute inset-0 bg-black/35" />
            <span className="absolute inset-x-4 bottom-3 text-white font-semibold text-lg">{c.name}</span>
          </StoreLink>
        ))}
      </div>
    </Wrap>
  );
}

function RichTextSection({ s }: { s: Settings }) {
  const center = str(s, "align", "start") === "center";
  return (
    <Wrap>
      <div className={`mx-auto max-w-3xl ${center ? "text-center" : ""}`}>
        <Heading text={str(s, "heading")} align={center ? "center" : "start"} />
        <RichText text={str(s, "body")} />
      </div>
    </Wrap>
  );
}

function ImageText({ s }: { s: Settings }) {
  const imageRight = str(s, "imagePosition", "left") === "right";
  return (
    <Wrap>
      <div className={`grid md:grid-cols-2 gap-8 items-center ${imageRight ? "md:[&>*:first-child]:order-2" : ""}`}>
        <div className="aspect-[4/3] overflow-hidden" style={{ borderRadius: "var(--sf-radius)" }}>
          <AssetPhoto assetId={str(s, "imageAssetId") || null} url={safeLink(str(s, "imageUrl"))} alt={str(s, "heading")} />
        </div>
        <div>
          <Heading text={str(s, "heading")} />
          <RichText text={str(s, "body")} />
          <div className="mt-5"><SectionButton label={str(s, "buttonLabel")} url={str(s, "buttonUrl")} /></div>
        </div>
      </div>
    </Wrap>
  );
}

function Banner({ s }: { s: Settings }) {
  const style = str(s, "style", "accent");
  const bg = style === "dark" ? "var(--sf-primary)" : style === "light" ? "var(--sf-surface)" : "var(--sf-accent)";
  const fg = style === "light" ? "var(--sf-text)" : "#fff";
  return (
    <section style={{ background: bg, color: fg }}>
      <div className="sf-container py-4 flex flex-col sm:flex-row items-center justify-center gap-3 text-center">
        <p className="font-semibold">{str(s, "text")}</p>
        <SectionButton label={str(s, "buttonLabel")} url={str(s, "buttonUrl")} variant="light" />
      </div>
    </section>
  );
}

const ICONS: Record<string, LucideIcon> = { truck: Truck, shield: ShieldCheck, refresh: RefreshCw, heart: Heart, star: Star, headset: Headset, tag: Tag, gift: Gift };
export const FEATURE_ICONS = Object.keys(ICONS);

function Features({ s }: { s: Settings }) {
  const items = arr<{ icon?: string; title?: string; text?: string }>(s, "items");
  return (
    <Wrap surface>
      <Heading text={str(s, "heading")} align="center" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it, i) => {
          const Icon = ICONS[it.icon ?? "star"] ?? Star;
          return (
            <div key={i} className="text-center px-4">
              <div className="mx-auto h-12 w-12 rounded-full flex items-center justify-center text-white" style={{ background: "var(--sf-accent)" }}><Icon className="h-6 w-6" /></div>
              <h3 className="mt-3 font-semibold">{it.title}</h3>
              <p className="text-sm sf-muted mt-1">{it.text}</p>
            </div>
          );
        })}
      </div>
    </Wrap>
  );
}

function Testimonials({ s }: { s: Settings }) {
  const items = arr<{ quote?: string; name?: string }>(s, "items");
  return (
    <Wrap>
      <Heading text={str(s, "heading")} align="center" />
      <div className="grid gap-5 md:grid-cols-3">
        {items.map((it, i) => (
          <figure key={i} className="sf-box p-5">
            <blockquote className="text-sm leading-relaxed">“{it.quote}”</blockquote>
            <figcaption className="mt-3 text-sm font-semibold">{it.name}</figcaption>
          </figure>
        ))}
      </div>
    </Wrap>
  );
}

function Faq({ s }: { s: Settings }) {
  const items = arr<{ q?: string; a?: string }>(s, "items");
  return (
    <Wrap>
      <div className="mx-auto max-w-3xl">
        <Heading text={str(s, "heading")} />
        <div className="space-y-2">
          {items.map((it, i) => (
            <details key={i} className="sf-box px-4 py-3 group">
              <summary className="cursor-pointer font-semibold list-none flex justify-between gap-3">{it.q}<span className="sf-muted group-open:rotate-45 transition-transform">+</span></summary>
              <div className="mt-2 text-sm sf-muted"><RichText text={it.a} /></div>
            </details>
          ))}
        </div>
      </div>
    </Wrap>
  );
}

function Gallery({ s }: { s: Settings }) {
  const images = arr<{ assetId?: string; url?: string; alt?: string; link?: string }>(s, "images");
  const cols = Math.min(5, Math.max(2, num(s, "columns", 3)));
  const lg = { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4", 5: "md:grid-cols-5" }[cols];
  return (
    <Wrap>
      <Heading text={str(s, "heading")} />
      <div className={`grid grid-cols-2 gap-3 ${lg}`}>
        {images.map((im, i) => {
          const pic = <div className="aspect-square overflow-hidden" style={{ borderRadius: "var(--sf-radius)" }}><AssetPhoto assetId={im.assetId || null} url={safeLink(im.url ?? "")} alt={im.alt ?? ""} /></div>;
          const to = safeLink(im.link ?? "");
          return to ? <StoreLink key={i} to={to}>{pic}</StoreLink> : <div key={i}>{pic}</div>;
        })}
      </div>
    </Wrap>
  );
}

/** Only video hosts we know how to embed. Anything else is not shown: an iframe to an arbitrary address would be a hole. */
export function videoEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = u.searchParams.get("v") ?? (u.pathname.startsWith("/embed/") ? u.pathname.slice(7) : null);
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
    }
    if (host === "vimeo.com") { const id = u.pathname.split("/").filter(Boolean)[0]; return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null; }
  } catch { /* not a URL */ }
  return null;
}

function Video({ s }: { s: Settings }) {
  const src = videoEmbedUrl(str(s, "url"));
  if (!src) return null;
  return (
    <Wrap>
      <div className="mx-auto max-w-3xl">
        <Heading text={str(s, "heading")} />
        <div className="aspect-video overflow-hidden" style={{ borderRadius: "var(--sf-radius)" }}>
          <iframe src={src} title={str(s, "heading") || "Video"} className="h-full w-full" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />
        </div>
      </div>
    </Wrap>
  );
}

function ContactInfo({ s }: { s: Settings }) {
  const { info } = useStore();
  const rows = [
    info.address && { icon: MapPin, text: info.address, href: null as string | null },
    info.contactPhone && { icon: Phone, text: info.contactPhone, href: `tel:${info.contactPhone}` },
    info.contactEmail && { icon: Mail, text: info.contactEmail, href: `mailto:${info.contactEmail}` },
  ].filter(Boolean) as { icon: LucideIcon; text: string; href: string | null }[];
  if (rows.length === 0) return null;
  return (
    <Wrap>
      <div className="mx-auto max-w-xl">
        <Heading text={str(s, "heading")} />
        <ul className="space-y-3">
          {rows.map((r, i) => (
            <li key={i} className="flex items-start gap-3">
              <r.icon className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "var(--sf-accent)" }} />
              {r.href ? <a href={r.href} className="hover:underline" dir="ltr">{r.text}</a> : <span className="whitespace-pre-line">{r.text}</span>}
            </li>
          ))}
        </ul>
      </div>
    </Wrap>
  );
}

const SECTIONS: Record<string, React.ComponentType<{ s: Settings }>> = {
  hero: Hero, featured_products: FeaturedProducts, collection_list: CollectionList, rich_text: RichTextSection, image_text: ImageText,
  banner: Banner, features: Features, testimonials: Testimonials, faq: Faq, gallery: Gallery, video: Video, contact_info: ContactInfo,
  spacer: ({ s }) => <div style={{ height: Math.min(200, Math.max(8, num(s, "size", 40))) }} />,
};

/** Draws a page's sections in order. Used by the live store and, unchanged, by the builder's preview — so what is edited is what is shown. */
export function SectionRenderer({ sections }: { sections: Section[] }) {
  return (
    <>
      {sections.map(sec => {
        const C = SECTIONS[sec.type];
        // An unknown type (a section from a newer version) is skipped, not allowed to blank the page.
        return C ? <C key={sec.id} s={(sec.settings ?? {}) as Settings} /> : null;
      })}
    </>
  );
}
