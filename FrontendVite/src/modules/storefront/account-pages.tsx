import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Package, Plus, Trash2, User } from "lucide-react";
import { ShopApiError, shopApi, type ShopAddress } from "@/lib/storefront/shop.api";
import { StoreLink, usePageMeta, useStore, useStoreNavigate } from "./store-context";
import { COUNTRY_CODES, FormField, Notice, PageSpinner, Spinner, useCountryNames } from "./sf-ui";

const msg = (e: unknown, fallback: string) => (e instanceof ShopApiError ? e.message : fallback);

// ── Signed out ───────────────────────────────────────────────────────────────

function SignedOut() {
  const { slug, t, setSession } = useStore();
  const [mode, setMode] = React.useState<"in" | "up" | "forgot">("in");
  const [f, setF] = React.useState({ email: "", password: "", firstName: "", lastName: "", phone: "", marketing: false });
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, [k]: k === "marketing" ? e.target.checked : e.target.value }));

  const submit = useMutation({
    mutationFn: async () => {
      if (mode === "forgot") { await shopApi.forgotPassword(slug, f.email); return null; }
      return mode === "in"
        ? shopApi.signIn(slug, f.email, f.password)
        : shopApi.register(slug, { email: f.email, password: f.password, firstName: f.firstName, lastName: f.lastName, phone: f.phone || undefined, acceptsMarketing: f.marketing });
    },
    onSuccess: s => { setError(null); if (s) setSession(s); else setInfo(t("account.resetSent")); },
    onError: e => setError(msg(e, t("error.generic"))),
  });

  return (
    <div className="sf-container py-12 max-w-md">
      <h1 className="text-2xl md:text-3xl font-bold text-center mb-6">{mode === "up" ? t("account.register") : mode === "forgot" ? t("account.forgot") : t("account.signIn")}</h1>
      <form className="sf-box p-6 space-y-4" onSubmit={e => { e.preventDefault(); setError(null); setInfo(null); submit.mutate(); }}>
        {mode === "up" && (
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t("account.firstName")}><input className="sf-input" required value={f.firstName} onChange={set("firstName")} autoComplete="given-name" /></FormField>
            <FormField label={t("account.lastName")}><input className="sf-input" required value={f.lastName} onChange={set("lastName")} autoComplete="family-name" /></FormField>
          </div>
        )}
        <FormField label={t("account.email")}><input className="sf-input" type="email" required value={f.email} onChange={set("email")} autoComplete="email" dir="ltr" /></FormField>
        {mode === "up" && <FormField label={`${t("account.phone")} (${t("common.optional")})`}><input className="sf-input" type="tel" value={f.phone} onChange={set("phone")} autoComplete="tel" dir="ltr" /></FormField>}
        {mode !== "forgot" && (
          <FormField label={t("account.password")} hint={mode === "up" ? t("account.passwordHint") : undefined}>
            <input className="sf-input" type="password" required minLength={mode === "up" ? 8 : undefined} value={f.password} onChange={set("password")} autoComplete={mode === "up" ? "new-password" : "current-password"} />
          </FormField>
        )}
        {mode === "up" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.marketing} onChange={set("marketing")} />{t("account.marketing")}</label>}
        {error && <Notice kind="error">{error}</Notice>}
        {info && <Notice kind="success">{info}</Notice>}
        <button className="sf-btn sf-btn-block" type="submit" disabled={submit.isPending}>
          {submit.isPending && <Spinner className="h-4 w-4" />}{mode === "up" ? t("account.register") : mode === "forgot" ? t("account.sendReset") : t("account.signIn")}
        </button>
        <div className="text-sm text-center space-y-2">
          {mode === "in" && <button type="button" className="underline sf-muted block mx-auto" onClick={() => { setMode("forgot"); setError(null); }}>{t("account.forgot")}</button>}
          {mode === "in" ? <p className="sf-muted">{t("account.needAccount")} <button type="button" className="underline font-semibold" onClick={() => { setMode("up"); setError(null); }}>{t("account.register")}</button></p>
            : <p className="sf-muted">{t("account.haveAccount")} <button type="button" className="underline font-semibold" onClick={() => { setMode("in"); setError(null); setInfo(null); }}>{t("account.signIn")}</button></p>}
        </div>
      </form>
    </div>
  );
}

// ── Signed in ────────────────────────────────────────────────────────────────

function Orders() {
  const { slug, t, money, session } = useStore();
  const q = useQuery({ queryKey: ["shop", slug, "my-orders", session!.token], queryFn: () => shopApi.myOrders(slug, session!.token), retry: false });
  if (q.isLoading) return <PageSpinner />;
  if (!q.data?.items.length) return <p className="sf-muted py-8 text-center">{t("account.noOrders")}</p>;
  return (
    <ul className="divide-y divide-slate-200 sf-box">
      {q.data.items.map(o => (
        <li key={o.number}>
          <StoreLink to={`/order/${o.number.replace("#", "")}?k=${o.accessToken}`} className="flex flex-wrap items-center justify-between gap-3 p-4 no-underline hover:bg-slate-50">
            <div><p className="font-semibold">{t("order.number", { number: o.number })}</p><p className="text-xs sf-muted">{new Date(o.createdAt + (o.createdAt.endsWith("Z") ? "" : "Z")).toLocaleDateString(undefined, { dateStyle: "medium" })} · {o.itemCount}</p></div>
            <span className="sf-badge bg-slate-100">{t(`status.${o.status}` as never)}</span>
            <span className="font-semibold">{money(o.total, o.currencyCode)}</span>
          </StoreLink>
        </li>
      ))}
    </ul>
  );
}

function AddressForm({ initial, onDone }: { initial: ShopAddress | null; onDone: () => void }) {
  const { slug, t, session, info } = useStore();
  const qc = useQueryClient();
  const countryName = useCountryNames();
  const countries = info.allCountries ? COUNTRY_CODES : info.countries;
  const [a, setA] = React.useState<Omit<ShopAddress, "id">>(initial ?? { name: "", phone: "", line1: "", line2: "", city: "", region: "", postalCode: "", country: countries.length === 1 ? countries[0] : "", isDefault: false });
  const [error, setError] = React.useState<string | null>(null);
  const set = (k: keyof typeof a) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setA(p => ({ ...p, [k]: k === "isDefault" ? (e.target as HTMLInputElement).checked : e.target.value }));
  const save = useMutation({
    mutationFn: () => shopApi.saveAddress(slug, session!.token, initial?.id ?? null, a),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shop", slug, "account"] }); onDone(); },
    onError: e => setError(msg(e, t("error.generic"))),
  });
  return (
    <form className="sf-box p-5 grid gap-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); setError(null); save.mutate(); }}>
      <div className="sm:col-span-2"><FormField label={t("checkout.name")}><input className="sf-input" required value={a.name} onChange={set("name")} /></FormField></div>
      <FormField label={t("checkout.country")}><select className="sf-input" required value={a.country} onChange={set("country")}><option value="">{t("checkout.chooseCountry")}</option>{countries.map(c => <option key={c} value={c}>{countryName(c)}</option>)}</select></FormField>
      <FormField label={t("checkout.phone")}><input className="sf-input" type="tel" value={a.phone ?? ""} onChange={set("phone")} dir="ltr" /></FormField>
      <div className="sm:col-span-2"><FormField label={t("checkout.line1")}><input className="sf-input" required value={a.line1} onChange={set("line1")} /></FormField></div>
      <div className="sm:col-span-2"><FormField label={t("checkout.line2")}><input className="sf-input" value={a.line2 ?? ""} onChange={set("line2")} /></FormField></div>
      <FormField label={t("checkout.city")}><input className="sf-input" required value={a.city} onChange={set("city")} /></FormField>
      <FormField label={t("checkout.region")}><input className="sf-input" value={a.region ?? ""} onChange={set("region")} /></FormField>
      <FormField label={t("checkout.postal")}><input className="sf-input" value={a.postalCode ?? ""} onChange={set("postalCode")} dir="ltr" /></FormField>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={a.isDefault} onChange={set("isDefault")} />{t("account.makeDefault")}</label>
      {error && <div className="sm:col-span-2"><Notice kind="error">{error}</Notice></div>}
      <div className="sm:col-span-2 flex gap-2"><button className="sf-btn" disabled={save.isPending}>{save.isPending && <Spinner className="h-4 w-4" />}{t("common.save")}</button><button type="button" className="sf-btn sf-btn-outline" onClick={onDone}>{t("common.cancel")}</button></div>
    </form>
  );
}

function Addresses({ addresses }: { addresses: ShopAddress[] }) {
  const { slug, t, session } = useStore();
  const qc = useQueryClient();
  const [editing, setEditing] = React.useState<ShopAddress | "new" | null>(null);
  const del = useMutation({
    mutationFn: (id: string) => shopApi.deleteAddress(slug, session!.token, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shop", slug, "account"] }),
  });
  if (editing) return <AddressForm initial={editing === "new" ? null : editing} onDone={() => setEditing(null)} />;
  return (
    <div className="space-y-3">
      {addresses.length === 0 && <p className="sf-muted py-4 text-center">{t("account.noAddresses")}</p>}
      {addresses.map(a => (
        <div key={a.id} className="sf-box p-4 flex justify-between gap-3">
          <div className="text-sm">
            <p className="font-semibold">{a.name} {a.isDefault && <span className="sf-badge bg-slate-100 ms-1">{t("account.default")}</span>}</p>
            <p className="sf-muted">{[a.line1, a.line2, a.city, a.region, a.postalCode, a.country].filter(Boolean).join(", ")}</p>
          </div>
          <div className="flex gap-3 text-sm shrink-0">
            <button className="underline" onClick={() => setEditing(a)}>{t("common.edit")}</button>
            <button className="underline text-red-600 inline-flex items-center gap-1" onClick={() => del.mutate(a.id)} aria-label={t("common.delete")}><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>
      ))}
      <button className="sf-btn sf-btn-outline" onClick={() => setEditing("new")}><Plus className="h-4 w-4" />{t("account.addAddress")}</button>
    </div>
  );
}

function Profile({ account }: { account: NonNullable<Awaited<ReturnType<typeof shopApi.account>>> }) {
  const { slug, t, session } = useStore();
  const qc = useQueryClient();
  const c = account.customer;
  const [f, setF] = React.useState({ firstName: c.firstName, lastName: c.lastName, phone: c.phone ?? "", marketing: c.acceptsMarketing, current: "", next: "" });
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => { setSaved(false); setF(p => ({ ...p, [k]: k === "marketing" ? e.target.checked : e.target.value })); };
  const save = useMutation({
    mutationFn: () => shopApi.updateAccount(slug, session!.token, { firstName: f.firstName, lastName: f.lastName, phone: f.phone || null, acceptsMarketing: f.marketing, currentPassword: f.current || undefined, newPassword: f.next || undefined }),
    onSuccess: () => { setSaved(true); setError(null); setF(p => ({ ...p, current: "", next: "" })); qc.invalidateQueries({ queryKey: ["shop", slug, "account"] }); },
    onError: e => setError(msg(e, t("error.generic"))),
  });
  return (
    <form className="sf-box p-5 grid gap-4 sm:grid-cols-2 max-w-2xl" onSubmit={e => { e.preventDefault(); setError(null); save.mutate(); }}>
      <FormField label={t("account.firstName")}><input className="sf-input" required value={f.firstName} onChange={set("firstName")} /></FormField>
      <FormField label={t("account.lastName")}><input className="sf-input" required value={f.lastName} onChange={set("lastName")} /></FormField>
      <div className="sm:col-span-2"><FormField label={t("account.email")}><input className="sf-input" value={c.email} disabled dir="ltr" /></FormField></div>
      <div className="sm:col-span-2"><FormField label={t("account.phone")}><input className="sf-input" type="tel" value={f.phone} onChange={set("phone")} dir="ltr" /></FormField></div>
      <FormField label={t("account.currentPassword")}><input className="sf-input" type="password" value={f.current} onChange={set("current")} autoComplete="current-password" /></FormField>
      <FormField label={t("account.newPassword")} hint={t("account.passwordHint")}><input className="sf-input" type="password" value={f.next} onChange={set("next")} autoComplete="new-password" /></FormField>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={f.marketing} onChange={set("marketing")} />{t("account.marketing")}</label>
      {error && <div className="sm:col-span-2"><Notice kind="error">{error}</Notice></div>}
      {saved && <div className="sm:col-span-2"><Notice kind="success">{t("account.saved")}</Notice></div>}
      <div className="sm:col-span-2"><button className="sf-btn" disabled={save.isPending}>{save.isPending && <Spinner className="h-4 w-4" />}{t("common.save")}</button></div>
    </form>
  );
}

export function AccountPage() {
  const { slug, t, session, setSession } = useStore();
  const [tab, setTab] = React.useState<"orders" | "addresses" | "profile">("orders");
  usePageMeta(t("account.title"));
  const account = useQuery({ queryKey: ["shop", slug, "account", session?.token], queryFn: () => shopApi.account(slug, session!.token), enabled: !!session, retry: false });

  // A rejected token (expired, or the password was changed elsewhere) means sign in again, not a broken page.
  React.useEffect(() => { if (account.error instanceof ShopApiError && account.error.unauthorized) setSession(null); }, [account.error, setSession]);

  if (!session) return <SignedOut />;
  if (account.isLoading || !account.data) return <PageSpinner />;

  const tabs = [{ id: "orders", label: t("account.orders"), icon: Package }, { id: "addresses", label: t("account.addresses"), icon: MapPin }, { id: "profile", label: t("account.profile"), icon: User }] as const;
  return (
    <div className="sf-container py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">{t("account.welcome", { name: account.data.customer.firstName })}</h1>
        <button className="sf-btn sf-btn-outline sf-btn-sm" onClick={() => setSession(null)}>{t("account.signOut")}</button>
      </div>
      <div className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto" role="tablist">
        {tabs.map(x => (
          <button key={x.id} role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)}
            className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap ${tab === x.id ? "border-[var(--sf-accent)]" : "border-transparent sf-muted"}`}>
            <x.icon className="h-4 w-4" />{x.label}
          </button>
        ))}
      </div>
      {tab === "orders" && <Orders />}
      {tab === "addresses" && <Addresses addresses={account.data.addresses} />}
      {tab === "profile" && <Profile account={account.data} />}
    </div>
  );
}

export function ResetPasswordPage() {
  const { slug, t } = useStore();
  const [sp] = useSearchParams();
  const go = useStoreNavigate();
  const [pw, setPw] = React.useState("");
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  usePageMeta(t("account.resetTitle"));
  const reset = useMutation({
    mutationFn: () => shopApi.resetPassword(slug, sp.get("email") ?? "", sp.get("token") ?? "", pw),
    onSuccess: () => { setDone(true); setTimeout(() => go("/account"), 1500); },
    onError: e => setError(msg(e, t("error.generic"))),
  });
  return (
    <div className="sf-container py-12 max-w-md">
      <h1 className="text-2xl font-bold text-center mb-6">{t("account.resetTitle")}</h1>
      <form className="sf-box p-6 space-y-4" onSubmit={e => { e.preventDefault(); setError(null); reset.mutate(); }}>
        <FormField label={t("account.newPassword")} hint={t("account.passwordHint")}><input className="sf-input" type="password" required minLength={8} value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" /></FormField>
        {error && <Notice kind="error">{error}</Notice>}
        {done && <Notice kind="success">{t("account.resetDone")}</Notice>}
        <button className="sf-btn sf-btn-block" disabled={reset.isPending || done}>{reset.isPending && <Spinner className="h-4 w-4" />}{t("common.save")}</button>
      </form>
    </div>
  );
}
