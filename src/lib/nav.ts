import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/lib/dictionary";

export interface NavChild {
  href: string;
  label: string;
}

export interface NavItem {
  href: string;
  label: string;
  children?: NavChild[];
}

/**
 * Builds the navigation from the client's information architecture.
 * Section links point at the listings page with the matching filter applied,
 * so there is one listings implementation rather than four near-copies.
 */
export function buildNav(
  locale: Locale,
  dict: Dictionary,
  developers: { value: string; label: { en: string; ar: string } }[],
): NavItem[] {
  const base = `/${locale}`;
  return [
    { href: base, label: dict.nav.home },
    {
      href: `${base}/properties?category=commercial`,
      label: dict.nav.commercial,
      children: [
        { href: `${base}/properties?category=commercial&purpose=buy`, label: dict.nav.sale },
        { href: `${base}/properties?category=commercial&purpose=rent`, label: dict.search.rent },
      ],
    },
    { href: `${base}/properties?category=residential`, label: dict.nav.residentials },
    {
      href: `${base}/properties?category=new_project`,
      label: dict.nav.newProjects,
      // Only developers that actually have listings appear, so the menu can
      // never advertise a section that opens empty.
      children: [
        { href: `${base}/properties?category=new_project`, label: dict.nav.allProjects },
        ...developers.map((d) => ({
          href: `${base}/properties?category=new_project&developer=${encodeURIComponent(d.value)}`,
          label: d.label[locale],
        })),
      ],
    },
    { href: `${base}/about`, label: dict.nav.about },
    { href: `${base}/contact`, label: dict.nav.contact },
  ];
}
