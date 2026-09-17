import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EnquiryForm } from "@/components/EnquiryForm";
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
  return { title: dict.nav.contact, description: dict.contact.lede };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const typed = locale as Locale;
  const dict = getDictionary(typed);

  const phone = process.env.NEXT_PUBLIC_PHONE ?? "+971 4 000 0000";
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP ?? "971500000000";
  const email = process.env.NEXT_PUBLIC_EMAIL ?? "hello@example.ae";

  return (
    <section className="container-content py-16 sm:py-24">
      <div className="grid gap-16 lg:grid-cols-[1fr_1.1fr] lg:gap-24">
        <div>
          <p className="eyebrow">{dict.contact.eyebrow}</p>
          <h1 className="mt-4 font-display text-4xl leading-tight text-ink-900 sm:text-5xl">
            {dict.contact.title}
          </h1>
          <p className="mt-6 max-w-md leading-relaxed text-ink-600">{dict.contact.lede}</p>

          <div className="mt-12 space-y-8">
            <div>
              <p className="eyebrow">{dict.contact.callUs}</p>
              {/* dir="ltr" keeps the + on the correct side under RTL. */}
              <a
                href={`tel:${phone.replace(/\s/g, "")}`}
                dir="ltr"
                className="mt-2 inline-block font-display text-2xl text-ink-900 hover:text-sand-600"
              >
                {phone}
              </a>
            </div>

            <div>
              <p className="eyebrow">{dict.contact.whatsapp}</p>
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
                className="mt-2 inline-block font-display text-2xl text-ink-900 hover:text-sand-600"
              >
                +{whatsapp}
              </a>
            </div>

            <div>
              <p className="eyebrow">{dict.contact.emailUs}</p>
              <a
                href={`mailto:${email}`}
                dir="ltr"
                className="mt-2 inline-block font-display text-2xl text-ink-900 hover:text-sand-600"
              >
                {email}
              </a>
            </div>

            <div>
              <p className="eyebrow">{dict.contact.hoursTitle}</p>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-ink-600">
                {dict.contact.hours}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-ink-200 bg-white p-6 sm:p-8">
          <EnquiryForm locale={typed} dict={dict} />
        </div>
      </div>
    </section>
  );
}
