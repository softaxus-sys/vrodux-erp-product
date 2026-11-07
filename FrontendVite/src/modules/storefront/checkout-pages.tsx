import * as React from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CreditCard, Landmark, Lock, Truck, Wallet } from "lucide-react";
import { ShopApiError, shopApi, type CheckoutRequest, type ShopAddress } from "@/lib/storefront/shop.api";
import { StoreLink, usePageMeta, useStore, useStoreNavigate } from "./store-context";
import { COUNTRY_CODES, FormField, Notice, PageSpinner, ProductPhoto, Spinner, useCountryNames } from "./sf-ui";
import { NotFound, DiscountBox } from "./catalogue-pages";
import { useQuote } from "./use-quote";

const METHOD_ICON = { stripe: CreditCard, paypal: Wallet, cod: Truck, bank: Landmark } as const;

// ── Checkout ─────────────────────────────────────────────────────────────────

interface Form {
  email: string; phone: string; name: string; line1: string; line2: string; city: string; region: string; postal: string; country: string; note: string;
}
const EMPTY: Form = { email: "", phone: "", name: "", line1: "", line2: "", city: "", region: "", postal: "", country: "", note: "" };

export function CheckoutPage() {
  const { slug, info, t, money, cart, clearCart, session, discountCode } = useStore();
  const go = useStoreNavigate();
  const countryName = useCountryNames();
  usePageMeta(t("checkout.title"));

  const countries = info.allCountries ? COUNTRY_CODES : info.countries;
  const [f, setF] = React.useState<Form>(EMPTY);
  const [zoneId, setZoneId] = React.useState<string | null>(null);
  const [method, setMethod] = React.useState(info.paymentMethods[0]?.method ?? "");
  const [saveAddress, setSaveAddress] = React.useState(false);
  const [errors, setErrors] = React.useState<Partial<Record<keyof Form | "form", string>>>({});
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { setF(p => ({ ...p, [k]: e.target.value })); setErrors(p => ({ ...p, [k]: undefined })); };

  // A signed-in shopper starts with their details and default address.
  const account = useQuery({ queryKey: ["shop", slug, "account", session?.token], queryFn: () => shopApi.account(slug, session!.token), enabled: !!session, staleTime: 60_000, retry: false });
  const applied = React.useRef(false);
  const applyAddress = React.useCallback((a: ShopAddress | undefined, c = account.data?.customer) => {
    setF(p => ({
      ...p, email: c?.email ?? p.email, phone: a?.phone ?? c?.phone ?? p.phone, name: a?.name ?? (c ? `${c.firstName} ${c.lastName}`.trim() : p.name),
      line1: a?.line1 ?? p.line1, line2: a?.line2 ?? p.line2, city: a?.city ?? p.city, region: a?.region ?? p.region, postal: a?.postalCode ?? p.postal,
      country: a?.country ?? (p.country || (countries.length === 1 ? countries[0] : "")),
    }));
  }, [account.data, countries]);
  React.useEffect(() => {
    if (applied.current || !account.data) return;
    applied.current = true;
    applyAddress(account.data.addresses.find(a => a.isDefault) ?? account.data.addresses[0], account.data.customer);
  }, [account.data, applyAddress]);
  React.useEffect(() => { if (!f.country && countries.length === 1) setF(p => ({ ...p, country: countries[0] })); }, [countries, f.country]);

  const quote = useQuote({ country: f.country || null, zoneId });
  const q = quote.data;
  // Follow the server's pick of delivery option until the shopper chooses.
  React.useEffect(() => { if (q?.selectedZoneId && (!zoneId || !q.shippingOptions.some(o => o.zoneId === zoneId))) setZoneId(q.selectedZoneId); }, [q, zoneId]);

  const place = useMutation({
    mutationFn: (body: CheckoutRequest) => shopApi.checkout(slug, body, session?.token ?? null),
    onSuccess: r => {
      clearCart();
      if (r.redirectUrl) window.location.assign(r.redirectUrl);
      else go(`/order/${r.orderNumber.replace("#", "")}?k=${r.accessToken}`, { replace: true });
    },
    onError: e => setErrors(p => ({ ...p, form: e instanceof ShopApiError ? e.message : t("error.generic") })),
  });

  if (cart.length === 0 && !place.isPending && !place.isSuccess)
    return <div className="sf-container py-24 text-center"><p className="sf-muted">{t("cart.empty")}</p><StoreLink to="/products" className="sf-btn mt-5">{t("cart.continue")}</StoreLink></div>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const req = t("common.required");
    const next: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) next.email = req;
    if (!f.name.trim()) next.name = req;
    if (info.requirePhone && !f.phone.trim()) next.phone = req;
    if (!f.line1.trim()) next.line1 = req;
    if (!f.city.trim()) next.city = req;
    if (!f.country) next.country = req;
    if (Object.keys(next).length) { setErrors(next); return; }
    if (!q?.canCheckout) { setErrors({ form: q?.blockedReason ?? t("cart.problems") }); return; }
    if (!zoneId) { setErrors({ form: t("checkout.noDelivery") }); return; }
    if (!method) return;
    setErrors({});
    place.mutate({
      items: cart.map(c => ({ productId: c.productId, quantity: c.quantity })), discountCode: discountCode.trim() || null,
      email: f.email.trim(), phone: f.phone.trim() || null, name: f.name.trim(), line1: f.line1.trim(), line2: f.line2.trim() || null, city: f.city.trim(),
      region: f.region.trim() || null, postalCode: f.postal.trim() || null, country: f.country, zoneId, paymentMethod: method, note: f.note.trim() || null, saveAddress: saveAddress && !!session,
    });
  };

  const blocked = !info.allowGuestCheckout && !session;

  return (
    <form className="sf-container py-8" onSubmit={submit} noValidate>
      <h1 className="text-2xl md:text-3xl font-bold mb-6">{t("checkout.title")}</h1>
      {blocked && <div className="mb-6"><Notice>{t("checkout.signInRequired")} <StoreLink to="/account" className="underline font-semibold">{t("checkout.signIn")}</StoreLink></Notice></div>}

      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="space-y-8">
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-lg font-bold">{t("checkout.contact")}</h2>
              {session ? <span className="text-xs sf-muted">{t("checkout.signedInAs", { email: session.customer.email })}</span>
                : <span className="text-sm sf-muted">{t("checkout.haveAccount")} <StoreLink to="/account" className="underline font-semibold">{t("checkout.signIn")}</StoreLink></span>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={t("checkout.email")} error={errors.email}><input className="sf-input" type="email" autoComplete="email" value={f.email} onChange={set("email")} dir="ltr" /></FormField>
              <FormField label={t("checkout.phone") + (info.requirePhone ? "" : ` (${t("common.optional")})`)} error={errors.phone}><input className="sf-input" type="tel" autoComplete="tel" value={f.phone} onChange={set("phone")} dir="ltr" /></FormField>
            </div>
          </section>

          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-lg font-bold">{t("checkout.address")}</h2>
              {(account.data?.addresses.length ?? 0) > 0 && (
                <select className="sf-input !w-auto !min-h-[36px] text-sm" aria-label={t("checkout.useSaved")} defaultValue="" onChange={e => { const a = account.data!.addresses.find(x => x.id === e.target.value); if (a) applyAddress(a); }}>
                  <option value="">{t("checkout.useSaved")}</option>
                  {account.data!.addresses.map(a => <option key={a.id} value={a.id}>{a.name} — {a.line1}, {a.city}</option>)}
                </select>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><FormField label={t("checkout.name")} error={errors.name}><input className="sf-input" autoComplete="name" value={f.name} onChange={set("name")} /></FormField></div>
              <div className="sm:col-span-2"><FormField label={t("checkout.country")} error={errors.country}>
                <select className="sf-input" autoComplete="country" value={f.country} onChange={e => { set("country")(e); setZoneId(null); }}>
                  <option value="">{t("checkout.chooseCountry")}</option>
                  {countries.map(c => <option key={c} value={c}>{countryName(c)}</option>)}
                </select>
              </FormField></div>
              <div className="sm:col-span-2"><FormField label={t("checkout.line1")} error={errors.line1}><input className="sf-input" autoComplete="address-line1" value={f.line1} onChange={set("line1")} /></FormField></div>
              <div className="sm:col-span-2"><FormField label={`${t("checkout.line2")} (${t("common.optional")})`}><input className="sf-input" autoComplete="address-line2" value={f.line2} onChange={set("line2")} /></FormField></div>
              <FormField label={t("checkout.city")} error={errors.city}><input className="sf-input" autoComplete="address-level2" value={f.city} onChange={set("city")} /></FormField>
              <FormField label={`${t("checkout.region")} (${t("common.optional")})`}><input className="sf-input" autoComplete="address-level1" value={f.region} onChange={set("region")} /></FormField>
              <FormField label={`${t("checkout.postal")} (${t("common.optional")})`}><input className="sf-input" autoComplete="postal-code" value={f.postal} onChange={set("postal")} dir="ltr" /></FormField>
            </div>
            {session && <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={saveAddress} onChange={e => setSaveAddress(e.target.checked)} />{t("checkout.saveAddress")}</label>}
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">{t("checkout.delivery")}</h2>
            {!f.country ? <p className="text-sm sf-muted">{t("checkout.deliveryNeedsCountry")}</p>
              : quote.isFetching && !q ? <Spinner />
              : (q?.shippingOptions.length ?? 0) === 0 ? <Notice kind="error">{t("checkout.noDelivery")}</Notice>
              : (
                <div className="space-y-2">
                  {q!.shippingOptions.map(o => (
                    <label key={o.zoneId} className={`flex items-center gap-3 sf-box p-4 cursor-pointer ${zoneId === o.zoneId ? "ring-2 ring-[var(--sf-accent)]" : ""}`}>
                      <input type="radio" name="zone" checked={zoneId === o.zoneId} onChange={() => setZoneId(o.zoneId)} />
                      <div className="flex-1"><p className="font-semibold text-sm">{o.name}</p>{o.estimatedDays && <p className="text-xs sf-muted">{o.estimatedDays}</p>}</div>
                      <span className="text-sm font-semibold">{o.free || o.price === 0 ? t("common.free") : money(o.price)}</span>
                    </label>
                  ))}
                </div>
              )}
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">{t("checkout.payment")}</h2>
            <div className="space-y-2">
              {info.paymentMethods.map(m => {
                const Icon = METHOD_ICON[m.method];
                return (
                  <label key={m.method} className={`block sf-box p-4 cursor-pointer ${method === m.method ? "ring-2 ring-[var(--sf-accent)]" : ""}`}>
                    <div className="flex items-center gap-3">
                      <input type="radio" name="method" checked={method === m.method} onChange={() => setMethod(m.method)} />
                      <Icon className="h-5 w-5" /><span className="font-semibold text-sm">{t(`method.${m.method}` as never)}</span>
                    </div>
                    {method === m.method && <p className="text-xs sf-muted mt-2 ms-8">{t(`checkout.payNote.${m.method}` as never)}</p>}
                  </label>
                );
              })}
            </div>
            <div className="mt-4"><FormField label={`${t("checkout.note")} (${t("common.optional")})`}><textarea className="sf-input" rows={2} maxLength={1000} value={f.note} onChange={set("note")} /></FormField></div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 h-fit sf-box p-5 space-y-4">
          <h2 className="text-lg font-bold">{t("checkout.summary")}</h2>
          <ul className="divide-y divide-slate-100">
            {cart.map(item => {
              const line = q?.lines.find(l => l.productId === item.productId);
              return (
                <li key={item.productId} className="flex gap-3 py-3">
                  <div className="relative h-14 w-14 shrink-0">
                    <div className="h-full w-full overflow-hidden" style={{ borderRadius: "var(--sf-radius)" }}>{item.templateId && <ProductPhoto templateId={item.templateId} imageId={item.imageId} alt="" />}</div>
                    <span className="absolute -top-1.5 -end-1.5 h-5 min-w-5 px-1 rounded-full bg-slate-700 text-white text-[11px] flex items-center justify-center">{item.quantity}</span>
                  </div>
                  <div className="flex-1 min-w-0 text-sm"><p className="font-medium line-clamp-2">{item.title}</p>{item.variantName && <p className="text-xs sf-muted">{item.variantName}</p>}{line?.problem && <p className="text-xs text-red-600">{line.problem}</p>}</div>
                  <p className="text-sm">{line && !line.problem ? money(line.lineTotal) : ""}</p>
                </li>
              );
            })}
          </ul>
          <DiscountBox />
          {q && (
            <dl className="text-sm space-y-2 border-t border-slate-100 pt-3">
              <div className="flex justify-between"><dt className="sf-muted">{t("cart.subtotal")}</dt><dd>{money(q.subtotal)}</dd></div>
              {q.discountTotal > 0 && <div className="flex justify-between text-green-700"><dt>{t("cart.discount")}</dt><dd>−{money(q.discountTotal)}</dd></div>}
              <div className="flex justify-between"><dt className="sf-muted">{t("cart.shipping")}</dt><dd>{q.selectedZoneId ? (q.shippingTotal === 0 ? t("common.free") : money(q.shippingTotal)) : "—"}</dd></div>
              {q.taxTotal > 0 && <div className="flex justify-between"><dt className="sf-muted">{info.pricesIncludeTax ? t("cart.taxIncluded", { amount: money(q.taxTotal) }) : t("cart.tax")}</dt><dd>{info.pricesIncludeTax ? "" : money(q.taxTotal)}</dd></div>}
              <div className="flex justify-between text-base font-bold border-t border-slate-200 pt-3"><dt>{t("cart.total")}</dt><dd>{money(q.total)}</dd></div>
            </dl>
          )}
          {errors.form && <Notice kind="error">{errors.form}</Notice>}
          <button className="sf-btn sf-btn-accent sf-btn-block" type="submit" disabled={place.isPending || blocked || !method || !q}>
            {place.isPending ? <><Spinner className="h-4 w-4" />{t("checkout.placing")}</> : <><Lock className="h-4 w-4" />{t("checkout.place")}</>}
          </button>
        </aside>
      </div>
    </form>
  );
}

// ── Order status ─────────────────────────────────────────────────────────────

export function OrderPage() {
  const { number = "" } = useParams();
  const [sp] = useSearchParams();
  const key = sp.get("k") ?? "";
  const paypalOrderId = sp.get("paypal") ? sp.get("token") : null;
  const justPaid = !!sp.get("paid");
  const { slug, t, money, info } = useStore();
  const qc = useQueryClient();
  const [captureError, setCaptureError] = React.useState<string | null>(null);
  const captured = React.useRef(false);
  usePageMeta(t("order.number", { number: `#${number}` }));

  const order = useQuery({
    queryKey: ["shop", slug, "order", number, key],
    queryFn: () => shopApi.order(slug, number, key),
    retry: false,
    // Straight after paying, the bank / provider may take a moment to confirm: keep asking for a little while.
    refetchInterval: q => (justPaid && q.state.data?.status === "awaiting_payment" && (q.state.dataUpdateCount ?? 0) < 20 ? 3000 : false),
  });

  // PayPal sends the shopper back here with their approved payment's id; taking the money is our step.
  React.useEffect(() => {
    if (!paypalOrderId || captured.current || !order.data || order.data.paymentStatus === "paid") return;
    captured.current = true;
    shopApi.capturePayPal(slug, number, key, paypalOrderId)
      .then(o => qc.setQueryData(["shop", slug, "order", number, key], o))
      .catch(e => setCaptureError(e instanceof ShopApiError ? e.message : t("error.generic")));
  }, [paypalOrderId, order.data, slug, number, key, qc, t]);

  const pay = useMutation({
    mutationFn: () => shopApi.payAgain(slug, number, key),
    onSuccess: r => { if (r.redirectUrl) window.location.assign(r.redirectUrl); },
  });

  if (order.isLoading) return <PageSpinner />;
  if (order.error || !order.data) return <div className="sf-container py-24 text-center"><p className="sf-muted">{t("order.notFound")}</p><StoreLink to="/" className="sf-btn mt-5">{t("notfound.home")}</StoreLink></div>;
  const o = order.data;
  const confirming = justPaid && o.status === "awaiting_payment";

  return (
    <div className="sf-container py-10 max-w-3xl">
      <div className="text-center">
        {o.status === "cancelled" ? null : <CheckCircle2 className="h-12 w-12 mx-auto" style={{ color: "var(--sf-accent)" }} />}
        <h1 className="text-2xl md:text-3xl font-bold mt-3">{o.status === "cancelled" ? t("status.cancelled") : t("order.thanks")}</h1>
        <p className="sf-muted mt-1">{t("order.number", { number: o.number })} · {t("order.confirmation", { email: o.email })}</p>
      </div>

      <div className="mt-8 space-y-4">
        {confirming && <Notice><span className="inline-flex items-center gap-2"><Spinner className="h-4 w-4" />{t("order.checking")}</span></Notice>}
        {captureError && <Notice kind="error">{captureError}</Notice>}
        {o.canPay && !confirming && (
          <div className="flex flex-wrap items-center gap-3 sf-box p-4">
            <span className="text-sm flex-1">{t(`status.awaiting_payment`)}</span>
            <button className="sf-btn" disabled={pay.isPending} onClick={() => pay.mutate()}>{pay.isPending && <Spinner className="h-4 w-4" />}{t("order.payNow")}</button>
            {pay.error && <p className="text-xs text-red-600 w-full">{(pay.error as Error).message}</p>}
          </div>
        )}
        {o.paymentInstructions && o.paymentStatus !== "paid" && (
          <div className="sf-box p-4"><p className="font-semibold text-sm mb-1">{t("order.howToPay")}</p><p className="text-sm whitespace-pre-line sf-muted">{o.paymentInstructions}</p></div>
        )}

        <div className="sf-box p-4 grid sm:grid-cols-3 gap-4 text-sm">
          <div><p className="sf-muted text-xs">{t("order.status")}</p><p className="font-semibold">{t(`status.${o.status}` as never)}</p></div>
          <div><p className="sf-muted text-xs">{t("order.payment")}</p><p className="font-semibold">{t(`method.${o.paymentMethod}` as never)} · {t(`pay.${o.paymentStatus}` as never)}</p></div>
          <div>
            <p className="sf-muted text-xs">{t("order.shippingTo")}</p>
            <p className="font-semibold">{o.shipName}</p>
            <p className="sf-muted">{[o.shipLine1, o.shipLine2, o.shipCity, o.shipRegion, o.shipPostal, o.shipCountry].filter(Boolean).join(", ")}</p>
          </div>
        </div>

        {(o.trackingNumber || o.trackingUrl) && (
          <div className="sf-box p-4 text-sm"><p className="font-semibold">{t("order.tracking")}</p><p className="sf-muted">{o.trackingCarrier} {o.trackingNumber}</p>
            {o.trackingUrl && /^https?:/i.test(o.trackingUrl) && <a className="underline" style={{ color: "var(--sf-accent)" }} href={o.trackingUrl} target="_blank" rel="noopener noreferrer">{t("order.track")}</a>}</div>
        )}

        <div className="sf-box p-4">
          <p className="font-semibold text-sm mb-2">{t("order.items")}</p>
          <ul className="divide-y divide-slate-100 text-sm">
            {o.lines.map((l, i) => (
              <li key={i} className="flex justify-between gap-3 py-2"><span>{l.title}{l.variantName ? ` — ${l.variantName}` : ""} × {l.quantity}</span><span>{money(l.lineTotal, o.currencyCode)}</span></li>
            ))}
          </ul>
          <dl className="text-sm space-y-1 border-t border-slate-100 mt-2 pt-2">
            <div className="flex justify-between"><dt className="sf-muted">{t("cart.subtotal")}</dt><dd>{money(o.subtotal, o.currencyCode)}</dd></div>
            {o.discountTotal > 0 && <div className="flex justify-between"><dt className="sf-muted">{t("cart.discount")}</dt><dd>−{money(o.discountTotal, o.currencyCode)}</dd></div>}
            <div className="flex justify-between"><dt className="sf-muted">{t("cart.shipping")}</dt><dd>{o.shippingTotal === 0 ? t("common.free") : money(o.shippingTotal, o.currencyCode)}</dd></div>
            {o.taxTotal > 0 && <div className="flex justify-between"><dt className="sf-muted">{info.pricesIncludeTax ? t("cart.taxIncluded", { amount: money(o.taxTotal, o.currencyCode) }) : t("cart.tax")}</dt><dd>{info.pricesIncludeTax ? "" : money(o.taxTotal, o.currencyCode)}</dd></div>}
            <div className="flex justify-between font-bold text-base pt-1"><dt>{t("cart.total")}</dt><dd>{money(o.total, o.currencyCode)}</dd></div>
          </dl>
        </div>
        <div className="text-center"><StoreLink to="/products" className="sf-btn sf-btn-outline">{t("cart.continue")}</StoreLink></div>
      </div>
    </div>
  );
}

export { NotFound };
