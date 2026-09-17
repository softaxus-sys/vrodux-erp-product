import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EnquiryForm } from "@/components/EnquiryForm";
import { PropertyCard } from "@/components/PropertyCard";
import { PropertyImage } from "@/components/PropertyImage";
import { isLocale, locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/lib/dictionary";
import { formatNumber, formatPrice } from "@/lib/format";
import { getAllProperties, getPropertyBySlug, getRelatedProperties } from "@/lib/properties";
import type { Furnishing, PropertyType } from "@/lib/types";

const TYPE_LABELS: Record<PropertyType, { en: string; ar: string }> = {
  apartment: { en: "Apartment", ar: "شقة" },
  villa: { en: "Villa", ar: "فيلا" },
  townhouse: { en: "Townhouse", ar: "تاون هاوس" },
  penthouse: { en: "Penthouse", ar: "بنتهاوس" },
  plot: { en: "Plot", ar: "أرض" },
  office: { en: "Office", ar: "مكتب" },
};

const FURNISHING_LABELS: Record<Furnishing, { en: string; ar: string }> = {
  furnished: { en: "Furnished", ar: "مفروش" },
  semi_furnished: { en: "Semi-furnished", ar: "نصف مفروش" },
  unfurnished: { en: "Unfurnished", ar: "غير مفروش" },
};

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    getAllProperties().map((p) => ({ locale, slug: p.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const property = getPropertyBySlug(slug);
  if (!property) return {};

  return {
    title: `${property.title[locale]} — ${property.community[locale]}`,
    description: property.description[locale].slice(0, 160),
    alternates: {
      canonical: `/${locale}/properties/${slug}`,
      languages: Object.fromEntries(
        locales.map((l) => [l, `/${l}/properties/${slug}`]),
      ),
    },
  };
}

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const property = getPropertyBySlug(slug);
  if (!property) notFound();

  const typed = locale as Locale;
  const dict = getDictionary(typed);
  const related = getRelatedProperties(property, 3);
  const title = property.title[typed];

  const facts: { label: string; value: string }[] = [
    { label: dict.property.type, value: TYPE_LABELS[property.type][typed] },
    {
      label: dict.property.purpose,
      value: property.purpose === "buy" ? dict.search.buy : dict.search.rent,
    },
    {
      label: dict.property.area,
      value: `${formatNumber(property.areaSqft, typed)} ${dict.common.sqft}`,
    },
    { label: dict.property.furnishing, value: FURNISHING_LABELS[property.furnishing][typed] },
  ];

  if (property.type !== "plot") {
    facts.splice(2, 0, {
      label: dict.property.bedrooms,
      value:
        property.bedrooms === 0
          ? dict.search.studio
          : formatNumber(property.bedrooms, typed),
    });
    if (property.bathrooms > 0) {
      facts.splice(3, 0, {
        label: dict.property.bathrooms,
        value: formatNumber(property.bathrooms, typed),
      });
    }
  }

  if (property.handover) {
    facts.push({ label: dict.property.handover, value: property.handover });
  }

  return (
    <article>
      <div className="container-content pt-8">
        <Link
          href={`/${typed}/properties`}
          className="text-sm text-ink-500 underline underline-offset-4 hover:text-ink-900"
        >
          ← {dict.property.back}
        </Link>
      </div>

      {/* Gallery. One hero plus a strip; a listing with a single photo simply fills the hero. */}
      <div className="container-content mt-6">
        <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
          <div className="aspect-[16/10] overflow-hidden rounded-2xl">
            <PropertyImage property={property} priority alt={title} />
          </div>
          {property.images.length > 1 && (
            <div className="grid gap-3">
              {property.images.slice(1, 3).map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt={title}
                  loading="lazy"
                  className="h-full w-full rounded-2xl object-cover"
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="container-content mt-12 grid gap-14 lg:grid-cols-[1.7fr_1fr] lg:items-start">
        <div>
          <p className="eyebrow">
            {property.community[typed]} · {property.emirate[typed]}
          </p>
          <h1 className="mt-3 font-display text-4xl leading-tight text-ink-900 sm:text-5xl">
            {title}
          </h1>

          <p className="mt-6 font-display text-3xl text-ink-900">
            {formatPrice(property.price, typed, dict.property.priceOnRequest)}
            {property.purpose === "rent" && property.price !== null && (
              <span className="text-base text-ink-400"> {dict.property.perYear}</span>
            )}
          </p>
          <p className="mt-2 text-xs uppercase tracking-wider text-ink-400">
            {dict.property.reference}: {property.reference}
          </p>

          <div className="mt-10">
            <h2 className="eyebrow">{dict.property.overview}</h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-600">
              {property.description[typed]}
            </p>
          </div>

          <dl className="mt-10 grid grid-cols-2 gap-6 border-y border-ink-200 py-8 sm:grid-cols-3">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="text-xs uppercase tracking-wider text-ink-400">{f.label}</dt>
                <dd className="mt-1.5 text-ink-900">{f.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-10">
            <h2 className="eyebrow">{dict.property.features}</h2>
            <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {property.features[typed].map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-ink-600">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-sand-500" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Enquiry rail. Sticky on desktop so it stays reachable through a long listing. */}
        <aside className="lg:sticky lg:top-28">
          <div className="rounded-2xl border border-ink-200 bg-white p-6">
            <h2 className="font-display text-2xl text-ink-900">{dict.property.enquireTitle}</h2>
            <p className="mt-2 text-sm text-ink-500">{dict.property.enquireBody}</p>
            <div className="mt-6">
              <EnquiryForm
                locale={typed}
                dict={dict}
                propertyReference={property.reference}
                propertyTitle={title}
                compact
              />
            </div>
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="container-content mt-24">
          <h2 className="eyebrow">{dict.property.similar}</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <PropertyCard key={p.slug} property={p} locale={typed} dict={dict} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
