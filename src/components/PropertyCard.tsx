import Link from "next/link";
import { PropertyImage } from "@/components/PropertyImage";
import { formatNumber, formatPriceCompact } from "@/lib/format";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/lib/dictionary";
import type { Property } from "@/lib/types";

export function PropertyCard({
  property,
  locale,
  dict,
  priority = false,
}: {
  property: Property;
  locale: Locale;
  dict: Dictionary;
  priority?: boolean;
}) {
  const bedLabel =
    property.bedrooms === 0
      ? dict.search.studio
      : `${formatNumber(property.bedrooms, locale)} ${
          property.bedrooms === 1 ? dict.common.bed : dict.common.beds
        }`;

  return (
    <Link
      href={`/${locale}/properties/${property.slug}`}
      className="group block overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,14,13,.06)] transition-shadow duration-300 hover:shadow-[0_18px_40px_-16px_rgba(15,14,13,.28)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <div className="h-full w-full transition-transform duration-700 group-hover:scale-[1.04]">
          <PropertyImage property={property} priority={priority} alt={property.title[locale]} />
        </div>
        <span className="absolute top-4 start-4 rounded-full bg-ink-950/75 px-3 py-1 text-[0.65rem] uppercase tracking-widest text-ink-50 backdrop-blur">
          {property.purpose === "buy" ? dict.search.buy : dict.search.rent}
        </span>
      </div>

      <div className="p-5">
        <p className="text-xs uppercase tracking-wider text-sand-600">
          {property.community[locale]} · {property.emirate[locale]}
        </p>
        <h3 className="mt-2 font-display text-xl leading-snug text-ink-900 line-clamp-2">
          {property.title[locale]}
        </h3>

        <p className="mt-3 text-lg text-ink-900">
          {formatPriceCompact(property.price, locale, dict.property.priceOnRequest)}
          {property.purpose === "rent" && property.price !== null && (
            <span className="text-sm text-ink-400"> {dict.property.perYear}</span>
          )}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-ink-100 pt-4 text-xs text-ink-500">
          {/* Plots and offices have no bedrooms; showing "0 beds" would read as a defect. */}
          {property.type !== "plot" && <span>{bedLabel}</span>}
          {property.bathrooms > 0 && (
            <span>
              {formatNumber(property.bathrooms, locale)}{" "}
              {property.bathrooms === 1 ? dict.common.bath : dict.common.baths}
            </span>
          )}
          <span>
            {formatNumber(property.areaSqft, locale)} {dict.common.sqft}
          </span>
        </div>
      </div>
    </Link>
  );
}
