import raw from "@/data/properties.json";
import type { Category, Property, Purpose, PropertyType } from "@/lib/types";

const properties = raw as Property[];

export function getAllProperties(): Property[] {
  return properties;
}

export function getFeaturedProperties(limit = 4): Property[] {
  return properties.filter((p) => p.featured).slice(0, limit);
}

export function getPropertyBySlug(slug: string): Property | undefined {
  return properties.find((p) => p.slug === slug);
}

/** Same community first, then anything in the same emirate. Never returns the property itself. */
export function getRelatedProperties(property: Property, limit = 3): Property[] {
  const others = properties.filter((p) => p.slug !== property.slug);
  const sameCommunity = others.filter((p) => p.community.en === property.community.en);
  const sameEmirate = others.filter(
    (p) => p.emirate.en === property.emirate.en && p.community.en !== property.community.en,
  );
  return [...sameCommunity, ...sameEmirate].slice(0, limit);
}

export interface PropertyFilters {
  purpose?: Purpose | "any";
  category?: Category | "any";
  developer?: string;
  community?: string;
  type?: PropertyType | "any";
  bedrooms?: number | "any";
  priceMin?: number;
  priceMax?: number;
}

/**
 * Listings with `price: null` (price on request) are deliberately kept when a price
 * bound is set. Excluding them would hide the most expensive instructions from
 * exactly the buyers filtering at the top of the market.
 */
export function filterProperties(list: Property[], f: PropertyFilters): Property[] {
  return list.filter((p) => {
    if (f.purpose && f.purpose !== "any" && p.purpose !== f.purpose) return false;
    if (f.category && f.category !== "any" && p.category !== f.category) return false;
    if (f.developer && f.developer !== "any" && p.developer?.en !== f.developer) return false;
    if (f.community && f.community !== "any" && p.community.en !== f.community) return false;
    if (f.type && f.type !== "any" && p.type !== f.type) return false;
    if (typeof f.bedrooms === "number" && p.bedrooms < f.bedrooms) return false;
    if (p.price !== null) {
      if (typeof f.priceMin === "number" && p.price < f.priceMin) return false;
      if (typeof f.priceMax === "number" && p.price > f.priceMax) return false;
    }
    return true;
  });
}

export function getCommunities(): { value: string; label: { en: string; ar: string } }[] {
  const seen = new Map<string, { en: string; ar: string }>();
  for (const p of properties) {
    if (!seen.has(p.community.en)) seen.set(p.community.en, p.community);
  }
  return [...seen.entries()].map(([value, label]) => ({ value, label }));
}

export function getPropertyTypes(): PropertyType[] {
  return [...new Set(properties.map((p) => p.type))];
}

/** Developers that actually have listings, for the New Projects submenu. */
export function getDevelopers(): { value: string; label: { en: string; ar: string } }[] {
  const seen = new Map<string, { en: string; ar: string }>();
  for (const p of properties) {
    if (p.category === "new_project" && p.developer && !seen.has(p.developer.en)) {
      seen.set(p.developer.en, p.developer);
    }
  }
  return [...seen.entries()].map(([value, label]) => ({ value, label }));
}

export function countByCategory(category: Category): number {
  return properties.filter((p) => p.category === category).length;
}
