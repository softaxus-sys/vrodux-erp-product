import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlignLeft, Columns2, Film, GalleryHorizontal, Grid3x3, HelpCircle, Image as ImageIcon, LayoutGrid, Mail, Megaphone, MessageSquareQuote, MoveVertical, Sparkles, Type, type LucideIcon } from "lucide-react";
import { shopApi } from "@/lib/storefront/shop.api";
import { FEATURE_ICONS } from "@/modules/storefront/sections";
import { useCollections } from "@/hooks/ecommerce/use-store";
import { ImageField, ItemsEditor, NumberField, SelectField, TextAreaField, TextField } from "./builder-fields";

type S = Record<string, unknown>;
export interface EditorProps { s: S; set: (key: string, value: unknown) => void; slug: string }

const str = (s: S, k: string, d = "") => (typeof s[k] === "string" ? (s[k] as string) : d);
const num = (s: S, k: string, d: number) => (typeof s[k] === "number" ? (s[k] as number) : d);
const list = <T,>(s: S, k: string): T[] => (Array.isArray(s[k]) ? (s[k] as T[]) : []);

function ButtonFields({ s, set }: EditorProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <TextField label="Button text" value={str(s, "buttonLabel")} onChange={v => set("buttonLabel", v)} />
      <TextField label="Button link" value={str(s, "buttonUrl")} onChange={v => set("buttonUrl", v)} placeholder="/products" dir="ltr" hint="A page in your store (/products) or a full web address." />
    </div>
  );
}

function ProductsEditor({ s, set, slug }: EditorProps) {
  const source = str(s, "source", "all");
  const collections = useCollections();
  const cats = useQuery({ queryKey: ["shop", slug, "categories"], queryFn: () => shopApi.categories(slug), staleTime: 60_000, retry: false });
  return (
    <>
      <TextField label="Heading" value={str(s, "heading")} onChange={v => set("heading", v)} />
      <SelectField label="Show" value={source} onChange={v => set("source", v)} options={[{ value: "all", label: "All products" }, { value: "collection", label: "A collection" }, { value: "category", label: "A category" }]} />
      {source === "collection" && (
        <SelectField label="Collection" value={str(s, "collection")} onChange={v => set("collection", v)}
          options={[{ value: "", label: "Choose…" }, ...(collections.data ?? []).map(c => ({ value: c.slug, label: c.name }))]} />
      )}
      {source === "category" && (
        <SelectField label="Category" value={str(s, "category")} onChange={v => set("category", v)}
          options={[{ value: "", label: "Choose…" }, ...(cats.data ?? []).map(c => ({ value: c.name, label: `${c.name} (${c.count})` }))]} />
      )}
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="How many" value={num(s, "limit", 8)} onChange={v => set("limit", v ?? 8)} min={2} max={24} />
        <SelectField label="Order" value={str(s, "sort", "newest")} onChange={v => set("sort", v)}
          options={[{ value: "newest", label: "Newest first" }, { value: "name", label: "Name" }, { value: "price_asc", label: "Price: low to high" }, { value: "price_desc", label: "Price: high to low" }]} />
      </div>
    </>
  );
}

export interface SectionDef {
  type: string; label: string; description: string; icon: LucideIcon;
  defaults: () => S;
  Editor: React.ComponentType<EditorProps>;
}

export const SECTION_DEFS: SectionDef[] = [
  {
    type: "hero", label: "Hero banner", description: "A big picture with a headline and a button.", icon: ImageIcon,
    defaults: () => ({ heading: "Welcome", subheading: "", buttonLabel: "Shop now", buttonUrl: "/products", align: "center", height: "md", overlay: 40 }),
    Editor: p => (
      <>
        <TextField label="Headline" value={str(p.s, "heading")} onChange={v => p.set("heading", v)} />
        <TextField label="Sub-headline" value={str(p.s, "subheading")} onChange={v => p.set("subheading", v)} />
        <ImageField label="Background picture" slug={p.slug} value={str(p.s, "imageAssetId") || null} onChange={v => p.set("imageAssetId", v ?? "")} />
        <ButtonFields {...p} />
        <div className="grid grid-cols-3 gap-3">
          <SelectField label="Text" value={str(p.s, "align", "center")} onChange={v => p.set("align", v)} options={[{ value: "center", label: "Centred" }, { value: "start", label: "Left" }]} />
          <SelectField label="Height" value={str(p.s, "height", "md")} onChange={v => p.set("height", v)} options={[{ value: "sm", label: "Small" }, { value: "md", label: "Medium" }, { value: "lg", label: "Large" }]} />
          <NumberField label="Darken picture %" value={num(p.s, "overlay", 40)} onChange={v => p.set("overlay", v ?? 0)} min={0} max={80} />
        </div>
      </>
    ),
  },
  {
    type: "featured_products", label: "Products", description: "A row of products from your catalogue.", icon: Grid3x3,
    defaults: () => ({ heading: "Our products", source: "all", limit: 8, sort: "newest" }), Editor: ProductsEditor,
  },
  {
    type: "collection_list", label: "Collections", description: "Cards linking to your collections.", icon: LayoutGrid,
    defaults: () => ({ heading: "Shop by collection", limit: 6 }),
    Editor: p => (
      <>
        <TextField label="Heading" value={str(p.s, "heading")} onChange={v => p.set("heading", v)} />
        <NumberField label="How many" value={num(p.s, "limit", 6)} onChange={v => p.set("limit", v ?? 6)} min={1} max={12} />
      </>
    ),
  },
  {
    type: "rich_text", label: "Text", description: "A heading and paragraphs.", icon: Type,
    defaults: () => ({ heading: "", body: "Write something here.", align: "start" }),
    Editor: p => (
      <>
        <TextField label="Heading" value={str(p.s, "heading")} onChange={v => p.set("heading", v)} />
        <TextAreaField label="Text" rows={7} value={str(p.s, "body")} onChange={v => p.set("body", v)} hint="Leave a blank line between paragraphs." />
        <SelectField label="Alignment" value={str(p.s, "align", "start")} onChange={v => p.set("align", v)} options={[{ value: "start", label: "Left" }, { value: "center", label: "Centred" }]} />
      </>
    ),
  },
  {
    type: "image_text", label: "Picture and text", description: "A picture beside some text.", icon: Columns2,
    defaults: () => ({ heading: "Our story", body: "", imagePosition: "left", buttonLabel: "", buttonUrl: "" }),
    Editor: p => (
      <>
        <TextField label="Heading" value={str(p.s, "heading")} onChange={v => p.set("heading", v)} />
        <TextAreaField label="Text" value={str(p.s, "body")} onChange={v => p.set("body", v)} />
        <ImageField label="Picture" slug={p.slug} value={str(p.s, "imageAssetId") || null} onChange={v => p.set("imageAssetId", v ?? "")} />
        <SelectField label="Picture position" value={str(p.s, "imagePosition", "left")} onChange={v => p.set("imagePosition", v)} options={[{ value: "left", label: "Left" }, { value: "right", label: "Right" }]} />
        <ButtonFields {...p} />
      </>
    ),
  },
  {
    type: "banner", label: "Announcement strip", description: "A coloured strip with a short message.", icon: Megaphone,
    defaults: () => ({ text: "Free delivery on orders over 200", buttonLabel: "", buttonUrl: "", style: "accent" }),
    Editor: p => (
      <>
        <TextField label="Message" value={str(p.s, "text")} onChange={v => p.set("text", v)} />
        <ButtonFields {...p} />
        <SelectField label="Colour" value={str(p.s, "style", "accent")} onChange={v => p.set("style", v)} options={[{ value: "accent", label: "Accent colour" }, { value: "dark", label: "Dark" }, { value: "light", label: "Light" }]} />
      </>
    ),
  },
  {
    type: "features", label: "Benefits", description: "Icons with short points (delivery, returns…).", icon: Sparkles,
    defaults: () => ({ heading: "", items: [{ icon: "truck", title: "Fast delivery", text: "We ship quickly." }, { icon: "shield", title: "Secure checkout", text: "Your details are safe." }, { icon: "refresh", title: "Easy returns", text: "No hassle." }] }),
    Editor: p => (
      <>
        <TextField label="Heading" value={str(p.s, "heading")} onChange={v => p.set("heading", v)} />
        <ItemsEditor label="Points" items={list<{ icon: string; title: string; text: string }>(p.s, "items")} onChange={v => p.set("items", v)} blank={{ icon: "star", title: "", text: "" }} max={6}
          render={(it, up) => (
            <>
              <SelectField label="Icon" value={it.icon} onChange={v => up({ icon: v })} options={FEATURE_ICONS.map(i => ({ value: i, label: i }))} />
              <TextField label="Title" value={it.title} onChange={v => up({ title: v })} />
              <TextField label="Text" value={it.text} onChange={v => up({ text: v })} />
            </>
          )} />
      </>
    ),
  },
  {
    type: "testimonials", label: "Reviews", description: "What customers say about you.", icon: MessageSquareQuote,
    defaults: () => ({ heading: "What our customers say", items: [{ quote: "Great quality and quick delivery.", name: "A happy customer" }] }),
    Editor: p => (
      <>
        <TextField label="Heading" value={str(p.s, "heading")} onChange={v => p.set("heading", v)} />
        <ItemsEditor label="Reviews" items={list<{ quote: string; name: string }>(p.s, "items")} onChange={v => p.set("items", v)} blank={{ quote: "", name: "" }} max={6}
          render={(it, up) => (<><TextAreaField label="Review" rows={2} value={it.quote} onChange={v => up({ quote: v })} /><TextField label="Name" value={it.name} onChange={v => up({ name: v })} /></>)} />
      </>
    ),
  },
  {
    type: "faq", label: "Questions", description: "Common questions and answers.", icon: HelpCircle,
    defaults: () => ({ heading: "Frequently asked questions", items: [{ q: "How long does delivery take?", a: "Usually 3–7 days." }] }),
    Editor: p => (
      <>
        <TextField label="Heading" value={str(p.s, "heading")} onChange={v => p.set("heading", v)} />
        <ItemsEditor label="Questions" items={list<{ q: string; a: string }>(p.s, "items")} onChange={v => p.set("items", v)} blank={{ q: "", a: "" }} max={20}
          render={(it, up) => (<><TextField label="Question" value={it.q} onChange={v => up({ q: v })} /><TextAreaField label="Answer" rows={2} value={it.a} onChange={v => up({ a: v })} /></>)} />
      </>
    ),
  },
  {
    type: "gallery", label: "Picture gallery", description: "A grid of pictures.", icon: GalleryHorizontal,
    defaults: () => ({ heading: "", columns: 3, images: [] }),
    Editor: p => (
      <>
        <TextField label="Heading" value={str(p.s, "heading")} onChange={v => p.set("heading", v)} />
        <NumberField label="Columns" value={num(p.s, "columns", 3)} onChange={v => p.set("columns", v ?? 3)} min={2} max={5} />
        <ItemsEditor label="Pictures" items={list<{ assetId: string; alt: string; link: string }>(p.s, "images")} onChange={v => p.set("images", v)} blank={{ assetId: "", alt: "", link: "" }} max={20}
          render={(it, up) => (
            <>
              <ImageField label="Picture" slug={p.slug} value={it.assetId || null} onChange={v => up({ assetId: v ?? "" })} />
              <TextField label="Describe it" value={it.alt} onChange={v => up({ alt: v })} />
              <TextField label="Link (optional)" value={it.link} onChange={v => up({ link: v })} dir="ltr" />
            </>
          )} />
      </>
    ),
  },
  {
    type: "video", label: "Video", description: "A YouTube or Vimeo video.", icon: Film,
    defaults: () => ({ heading: "", url: "" }),
    Editor: p => (
      <>
        <TextField label="Heading" value={str(p.s, "heading")} onChange={v => p.set("heading", v)} />
        <TextField label="Video address" value={str(p.s, "url")} onChange={v => p.set("url", v)} placeholder="https://www.youtube.com/watch?v=…" dir="ltr" hint="YouTube and Vimeo links only." />
      </>
    ),
  },
  {
    type: "contact_info", label: "Contact details", description: "Your address, phone and email (from Store details).", icon: Mail,
    defaults: () => ({ heading: "Get in touch" }),
    Editor: p => <TextField label="Heading" value={str(p.s, "heading")} onChange={v => p.set("heading", v)} />,
  },
  {
    type: "spacer", label: "Space", description: "Empty space between sections.", icon: MoveVertical,
    defaults: () => ({ size: 40 }),
    Editor: p => <NumberField label="Height (px)" value={num(p.s, "size", 40)} onChange={v => p.set("size", v ?? 40)} min={8} max={200} />,
  },
];

export const SECTION_BY_TYPE = Object.fromEntries(SECTION_DEFS.map(d => [d.type, d]));
export { AlignLeft };
