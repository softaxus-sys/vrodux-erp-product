export type Purpose = "buy" | "rent";
export type PropertyType = "apartment" | "villa" | "townhouse" | "penthouse" | "plot" | "office";
export type Furnishing = "furnished" | "semi_furnished" | "unfurnished";

export interface LocalisedText {
  en: string;
  ar: string;
}

export interface Property {
  /** Stable URL segment. Never reuse a slug for a different unit. */
  slug: string;
  /** Shown to clients and quoted on enquiries. */
  reference: string;
  purpose: Purpose;
  type: PropertyType;
  title: LocalisedText;
  community: LocalisedText;
  emirate: LocalisedText;
  description: LocalisedText;
  /** Price in AED. For rentals this is the annual figure. null = price on request. */
  price: number | null;
  /** 0 means studio. */
  bedrooms: number;
  bathrooms: number;
  /** Built-up area, square feet. */
  areaSqft: number;
  furnishing: Furnishing;
  handover?: string;
  features: { en: string[]; ar: string[] };
  /**
   * Photography. Drop real images into /public/properties/<slug>/ and list them here.
   * While a listing has no photos, the UI renders a branded placeholder rather than a
   * broken image — so the site is presentable before the shoot is delivered.
   */
  images: string[];
  /** Approximate map centre, used for the location block. */
  coordinates?: { lat: number; lng: number };
  featured: boolean;
}
