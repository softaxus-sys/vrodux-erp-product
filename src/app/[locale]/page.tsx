import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PropertyCard } from "@/components/PropertyCard";
import { SearchFilters } from "@/components/SearchFilters";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/lib/dictionary";
import { getCommunities, getFeaturedProperties, getPropertyTypes } from "@/lib/properties";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const typed = locale as Locale;
  const dict = getDictionary(typed);
  const featured = getFeaturedProperties(4);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink-950 text-ink-50">
        <div
          aria-hidden
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(120% 90% at 78% 8%, #8a5a39 0%, transparent 58%), linear-gradient(190deg, #1a1918 0%, #0f0e0d 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.05] [background-image:repeating-linear-gradient(90deg,#fff_0_1px,transparent_1px_92px)]"
        />

        <div className="container-content relative py-24 sm:py-32 lg:py-40">
          <p className="eyebrow animate-rise text-sand-400">{dict.home.eyebrow}</p>
          <h1 className="mt-6 max-w-3xl animate-rise font-display text-5xl leading-[1.05] sm:text-6xl lg:text-7xl">
            {dict.home.title}
          </h1>
          <p className="mt-7 max-w-xl animate-rise text-lg leading-relaxed text-ink-300">
            {dict.home.lede}
          </p>
          <div className="mt-10 flex animate-rise flex-wrap gap-3">
            <Link href={`/${typed}/properties`} className="btn-accent">
              {dict.home.cta}
            </Link>
            <Link
              href={`/${typed}/contact`}
              className="btn border border-ink-700 text-ink-100 hover:border-ink-100 hover:bg-ink-50 hover:text-ink-950"
            >
              {dict.home.ctaSecondary}
            </Link>
          </div>
        </div>

        {/* Search sits astride the hero edge so it reads as the primary action. */}
        <div className="container-content relative -mb-14 translate-y-14">
          <p className="mb-3 text-xs uppercase tracking-widest text-ink-400">
            {dict.home.searchTitle}
          </p>
          <Suspense fallback={<div className="h-32 rounded-2xl bg-white/90" />}>
            <SearchFilters
              locale={typed}
              dict={dict}
              communities={getCommunities()}
              types={getPropertyTypes()}
              compact
            />
          </Suspense>
        </div>
      </section>

      {/* Stats */}
      <section className="container-content pt-28 sm:pt-32">
        <p className="eyebrow">{dict.home.statsTitle}</p>
        <dl className="mt-8 grid gap-8 border-t border-ink-200 pt-8 sm:grid-cols-2 lg:grid-cols-4">
          {dict.home.stats.map((s) => (
            <div key={s.label}>
              <dt className="font-display text-4xl text-ink-900">{s.value}</dt>
              <dd className="mt-2 text-sm text-ink-500">{s.label}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Featured */}
      <section className="container-content pt-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <p className="eyebrow">{dict.home.featuredTitle}</p>
            <h2 className="mt-3 font-display text-4xl text-ink-900 sm:text-5xl">
              {dict.home.featuredLede}
            </h2>
          </div>
          <Link
            href={`/${typed}/properties`}
            className="text-sm text-ink-600 underline underline-offset-8 hover:text-ink-900"
          >
            {dict.home.viewAll}
          </Link>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((p, i) => (
            <PropertyCard
              key={p.slug}
              property={p}
              locale={typed}
              dict={dict}
              priority={i < 2}
            />
          ))}
        </div>
      </section>

      {/* Process */}
      <section className="container-content pt-28">
        <p className="eyebrow">{dict.home.processTitle}</p>
        <div className="mt-10 grid gap-10 border-t border-ink-200 pt-10 lg:grid-cols-3">
          {dict.home.process.map((step) => (
            <div key={step.step}>
              <span className="font-display text-5xl text-sand-300">{step.step}</span>
              <h3 className="mt-4 font-display text-2xl text-ink-900">{step.title}</h3>
              <p className="mt-3 leading-relaxed text-ink-500">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="container-content pt-28">
        <div className="overflow-hidden rounded-3xl bg-ink-900 px-8 py-16 text-center text-ink-50 sm:px-16">
          <h2 className="mx-auto max-w-2xl font-display text-4xl leading-tight sm:text-5xl">
            {dict.home.ctaBandTitle}
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-ink-300">{dict.home.ctaBandBody}</p>
          <Link href={`/${typed}/contact`} className="btn-accent mt-9">
            {dict.home.ctaBandButton}
          </Link>
        </div>
      </section>
    </>
  );
}
