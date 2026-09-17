import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { PropertyCard } from "@/components/PropertyCard";
import { SearchFilters } from "@/components/SearchFilters";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary, plural } from "@/lib/dictionary";
import {
  filterProperties,
  getAllProperties,
  getCommunities,
  getPropertyTypes,
} from "@/lib/properties";
import type { Category, PropertyType, Purpose } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return { title: dict.nav.properties, description: dict.home.featuredLede };
}

function toNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export default async function PropertiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const typed = locale as Locale;
  const dict = getDictionary(typed);
  const sp = await searchParams;

  const one = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const bedroomsRaw = one("bedrooms");
  const results = filterProperties(getAllProperties(), {
    purpose: (one("purpose") as Purpose | "any") ?? "any",
    category: (one("category") as Category | "any") ?? "any",
    developer: one("developer"),
    community: one("community"),
    type: (one("type") as PropertyType | "any") ?? "any",
    bedrooms: bedroomsRaw === undefined || bedroomsRaw === "any" ? "any" : Number(bedroomsRaw),
    priceMin: toNumber(one("priceMin")),
    priceMax: toNumber(one("priceMax")),
  });

  const category = one("category");
  const developer = one("developer");
  const heading =
    developer ??
    (category === "commercial"
      ? dict.nav.commercial
      : category === "residential"
        ? dict.nav.residentials
        : category === "new_project"
          ? dict.nav.newProjects
          : dict.nav.properties);

  return (
    <section className="container-content py-14 sm:py-20">
      <p className="eyebrow">{dict.brand.tagline}</p>
      <h1 className="mt-3 font-display text-4xl font-semibold text-ink-800 sm:text-5xl">
        {heading}
      </h1>

      <div className="mt-8">
        <Suspense fallback={<div className="h-36 rounded-2xl border border-ink-200 bg-white" />}>
          <SearchFilters
            locale={typed}
            dict={dict}
            communities={getCommunities()}
            types={getPropertyTypes()}
          />
        </Suspense>
      </div>

      <p className="mt-6 text-sm text-ink-500">
        {plural(typed, results.length, {
          one: dict.search.results_one,
          other: dict.search.results_other,
        })}
      </p>

      {results.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-ink-300 px-8 py-16 text-center">
          <p className="font-display text-2xl text-ink-900">{dict.search.empty}</p>
          <p className="mx-auto mt-3 max-w-md text-sm text-ink-500">{dict.search.emptyBody}</p>
          <Link href={`/${typed}/contact`} className="btn-primary mt-7">
            {dict.nav.enquire}
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((p, i) => (
            <PropertyCard
              key={p.slug}
              property={p}
              locale={typed}
              dict={dict}
              priority={i < 3}
            />
          ))}
        </div>
      )}
    </section>
  );
}
