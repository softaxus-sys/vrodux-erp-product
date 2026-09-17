"use client";

import { useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/lib/dictionary";

type Status = "idle" | "sending" | "sent" | "error";
type Errors = Partial<Record<"firstName" | "email" | "phone" | "contact", string>>;

export function EnquiryForm({
  locale,
  dict,
  propertyReference,
  propertyTitle,
  compact = false,
}: {
  locale: Locale;
  dict: Dictionary;
  propertyReference?: string;
  propertyTitle?: string;
  compact?: boolean;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Errors>({});

  const timeframeOptions = Object.entries(dict.form.timeframeOptions) as [string, string][];

  function clearError(field: keyof Errors) {
    // A message left up while the visitor is fixing the value reads as "still wrong"
    // when it no longer is.
    setErrors((prev) => {
      if (!prev[field] && !prev.contact) return prev;
      const next = { ...prev };
      delete next[field];
      delete next.contact;
      return next;
    });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const get = (k: string) => String(data.get(k) ?? "").trim();

    const firstName = get("firstName");
    const email = get("email");
    const phone = get("phone");

    const found: Errors = {};
    if (!firstName) found.firstName = dict.form.required;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) found.email = dict.form.invalidEmail;
    if (!email && !phone) found.contact = dict.form.needContact;

    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    setErrors({});
    setStatus("sending");

    try {
      const res = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName: get("lastName"),
          email,
          phone,
          whatsapp: get("whatsapp"),
          interested_in: propertyTitle
            ? `${propertyTitle}${propertyReference ? ` (${propertyReference})` : ""}`
            : get("interestedIn"),
          budget: get("budget"),
          timeframe: get("timeframe"),
          message: get("message"),
          form_name: propertyReference ? `Property enquiry — ${propertyReference}` : "Website enquiry",
          property_reference: propertyReference,
          page_url: typeof window !== "undefined" ? window.location.href : undefined,
          locale,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus("sent");
      form.reset();
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div
        role="status"
        className="rounded-2xl border border-sand-200 bg-sand-50 p-8 text-center"
      >
        <p className="font-display text-2xl text-ink-900">{dict.form.successTitle}</p>
        <p className="mt-2 text-sm text-ink-600">{dict.form.successBody}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {errors.contact && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errors.contact}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="field-label">{dict.form.firstName}</label>
          <input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            aria-invalid={errors.firstName ? true : undefined}
            onChange={() => clearError("firstName")}
            className={`field ${errors.firstName ? "field-error" : ""}`}
          />
          {errors.firstName && (
            <p role="alert" className="mt-1 text-xs text-red-600">{errors.firstName}</p>
          )}
        </div>
        <div>
          <label htmlFor="lastName" className="field-label">{dict.form.lastName}</label>
          <input id="lastName" name="lastName" autoComplete="family-name" className="field" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="email" className="field-label">{dict.form.email}</label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            dir="ltr"
            aria-invalid={errors.email ? true : undefined}
            onChange={() => clearError("email")}
            className={`field ${errors.email ? "field-error" : ""}`}
          />
          {errors.email && (
            <p role="alert" className="mt-1 text-xs text-red-600">{errors.email}</p>
          )}
        </div>
        <div>
          <label htmlFor="phone" className="field-label">{dict.form.phone}</label>
          {/* dir="ltr" on every phone/email field: an RTL container otherwise renders
              "+971 50..." with the plus on the wrong end. */}
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            onChange={() => clearError("phone")}
            className="field"
          />
        </div>
      </div>

      {!compact && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="whatsapp" className="field-label">{dict.form.whatsapp}</label>
            <input id="whatsapp" name="whatsapp" type="tel" inputMode="tel" dir="ltr" className="field" />
          </div>
          <div>
            <label htmlFor="budget" className="field-label">{dict.form.budget}</label>
            <input
              id="budget"
              name="budget"
              placeholder={dict.form.budgetPlaceholder}
              className="field"
            />
          </div>
        </div>
      )}

      {!propertyReference && (
        <div>
          <label htmlFor="interestedIn" className="field-label">{dict.form.interestedIn}</label>
          <input
            id="interestedIn"
            name="interestedIn"
            placeholder={dict.form.interestedInPlaceholder}
            className="field"
          />
        </div>
      )}

      <div>
        <label htmlFor="timeframe" className="field-label">{dict.form.timeframe}</label>
        <select id="timeframe" name="timeframe" className="field" defaultValue="">
          <option value="" />
          {timeframeOptions.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="message" className="field-label">{dict.form.message}</label>
        <textarea id="message" name="message" rows={compact ? 3 : 4} className="field resize-y" />
      </div>

      {status === "error" && (
        <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <p className="font-medium">{dict.form.errorTitle}</p>
          <p>{dict.form.errorBody}</p>
        </div>
      )}

      <button type="submit" disabled={status === "sending"} className="btn-primary w-full">
        {status === "sending" ? dict.form.sending : dict.form.submit}
      </button>

      <p className="text-xs leading-relaxed text-ink-400">{dict.form.consent}</p>
    </form>
  );
}
