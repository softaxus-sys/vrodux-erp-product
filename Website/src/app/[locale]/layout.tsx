import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { buildNav } from "@/lib/nav";
import { getDevelopers } from "@/lib/properties";
import { Footer } from "@/components/Footer";
import { isLocale, locales, localeMeta, type Locale } from "@/i18n/config";
import { getDictionary } from "@/lib/dictionary";
import "../globals.css";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);

  return {
    title: {
      default: `${dict.brand.name} — ${dict.brand.tagline}`,
      template: `%s · ${dict.brand.name}`,
    },
    description: dict.home.lede,
    alternates: {
      canonical: `/${locale}`,
      // Tells search engines the two language versions are the same page, so an
      // Arabic searcher is served the Arabic URL instead of the English one.
      languages: Object.fromEntries(locales.map((l) => [localeMeta[l].htmlLang, `/${l}`])),
    },
    openGraph: {
      type: "website",
      locale: locale === "ar" ? "ar_AE" : "en_AE",
      title: `${dict.brand.name} — ${dict.brand.tagline}`,
      description: dict.home.lede,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const typed = locale as Locale;
  const dict = getDictionary(typed);
  const { dir, htmlLang } = localeMeta[typed];

  return (
    <html lang={htmlLang} dir={dir}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cabin:wght@400;500;600;700&family=Poppins:wght@300;400;500;600&family=Noto+Kufi+Arabic:wght@300;400;500;600&display=swap"
        />
      </head>
      <body className="flex min-h-screen flex-col">
        <Header locale={typed} dict={dict} items={buildNav(typed, dict, getDevelopers())} />
        <main className="flex-1">{children}</main>
        <Footer locale={typed} dict={dict} />
      </body>
    </html>
  );
}
