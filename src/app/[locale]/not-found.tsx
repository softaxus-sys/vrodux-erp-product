import Link from "next/link";
import { getDictionary } from "@/lib/dictionary";
import { defaultLocale } from "@/i18n/config";

export default function NotFound() {
  // A not-found page cannot read route params, so it renders in the default locale.
  const dict = getDictionary(defaultLocale);

  return (
    <section className="container-content flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-4 font-display text-4xl text-ink-900 sm:text-5xl">
        {dict.common.notFoundTitle}
      </h1>
      <p className="mt-4 max-w-md text-ink-500">{dict.common.notFoundBody}</p>
      <Link href={`/${defaultLocale}/properties`} className="btn-primary mt-8">
        {dict.common.notFoundCta}
      </Link>
    </section>
  );
}
