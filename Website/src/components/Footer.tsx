import Link from "next/link";
import { Logo } from "@/components/Logo";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/lib/dictionary";

export function Footer({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const phone = process.env.NEXT_PUBLIC_PHONE ?? "+971 4 000 0000";
  const email = process.env.NEXT_PUBLIC_EMAIL ?? "hello@example.ae";
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 bg-ink-950 text-ink-300">
      <div className="container-content grid gap-12 py-16 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Logo name={dict.brand.name} variant="dark" />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-400">{dict.footer.blurb}</p>
          <div className="mt-6 space-y-1.5 text-sm">
            <a href={`tel:${phone.replace(/\s/g, "")}`} className="block hover:text-sand-300">
              {phone}
            </a>
            <a href={`mailto:${email}`} className="block hover:text-sand-300">
              {email}
            </a>
          </div>
        </div>

        <div>
          <p className="eyebrow mb-4 text-sand-500">{dict.footer.explore}</p>
          <ul className="space-y-2.5 text-sm">
            <li><Link href={`/${locale}/properties`} className="hover:text-sand-300">{dict.nav.properties}</Link></li>
            <li><Link href={`/${locale}/about`} className="hover:text-sand-300">{dict.nav.about}</Link></li>
            <li><Link href={`/${locale}/contact`} className="hover:text-sand-300">{dict.nav.contact}</Link></li>
          </ul>
        </div>

        <div>
          <p className="eyebrow mb-4 text-sand-500">{dict.footer.legal}</p>
          <ul className="space-y-2.5 text-sm">
            <li><span className="text-ink-500">{dict.footer.privacy}</span></li>
            <li><span className="text-ink-500">{dict.footer.terms}</span></li>
          </ul>
          <p className="mt-6 text-xs leading-relaxed text-ink-600">{dict.footer.permit}</p>
        </div>
      </div>

      <div className="border-t border-ink-900">
        <div className="container-content flex flex-col gap-2 py-6 text-xs text-ink-600 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} {dict.brand.name}. {dict.footer.rights}</p>
        </div>
      </div>
    </footer>
  );
}
