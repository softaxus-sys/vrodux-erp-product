import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/lib/dictionary";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return { title: dict.nav.about, description: dict.about.lede.slice(0, 160) };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const typed = locale as Locale;
  const dict = getDictionary(typed);

  return (
    <>
      <section className="border-b border-ink-200 bg-white">
        <div className="container-content py-20 sm:py-28">
          <p className="eyebrow">{dict.about.eyebrow}</p>
          <h1 className="mt-4 max-w-3xl font-display text-5xl leading-[1.08] text-ink-900 sm:text-6xl">
            {dict.about.title}
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-600">
            {dict.about.lede}
          </p>
        </div>
      </section>

      <section className="container-content py-20">
        <div className="grid gap-12 lg:grid-cols-3">
          {dict.about.sections.map((s) => (
            <div key={s.title} className="border-t border-ink-300 pt-6">
              <h2 className="font-display text-2xl text-ink-900">{s.title}</h2>
              <p className="mt-4 leading-relaxed text-ink-600">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-content pb-8">
        <div className="rounded-3xl bg-ink-900 px-8 py-14 text-ink-50 sm:px-14">
          <p className="eyebrow text-sand-400">{dict.about.valuesTitle}</p>
          <div className="mt-10 grid gap-10 sm:grid-cols-3">
            {dict.about.values.map((v) => (
              <div key={v.title}>
                <h3 className="font-display text-2xl">{v.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-300">{v.body}</p>
              </div>
            ))}
          </div>
          <Link href={`/${typed}/contact`} className="btn-accent mt-12">
            {dict.home.ctaBandButton}
          </Link>
        </div>
      </section>
    </>
  );
}
