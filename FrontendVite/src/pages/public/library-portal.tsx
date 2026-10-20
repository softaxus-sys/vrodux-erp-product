import * as React from "react";
import { useParams } from "react-router-dom";
import {
  BookOpen, BookMarked, CalendarClock, KeyRound, Library, Loader2, LogOut, RefreshCw, Search, X,
} from "lucide-react";
import {
  portalApi, PortalError,
  type PortalAccountDto, type PortalInfoDto, type PortalSessionDto, type PortalTitleDto,
} from "@/lib/library/portal.api";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

/**
 * The page a library member opens to see what they have out, renew it, and find and reserve
 * books. No staff sign-in, no app layout, no auth store and no theme: a member is not a user of
 * the application. They sign in with their card number and the PIN the library gave them.
 *
 * English only for now — the member's language is not the library's interface language.
 */

type Tab = "loans" | "reservations" | "search" | "fines";

const BTN = "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 h-10 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_PRIMARY = cn(BTN, "bg-indigo-600 text-white hover:bg-indigo-700");
const BTN_GHOST = cn(BTN, "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50");
const INPUT = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500";

function sessionKey(slug: string) { return `library-portal:${slug}`; }

// Storage can be unavailable (private window, blocked site data); the page still works, it
// just asks for the PIN again after a reload.
function loadSession(slug: string): PortalSessionDto | null {
  try {
    const raw = sessionStorage.getItem(sessionKey(slug));
    if (!raw) return null;
    const s = JSON.parse(raw) as PortalSessionDto;
    return new Date(s.expiresAt).getTime() > Date.now() ? s : null;
  } catch { return null; }
}
function storeSession(slug: string, s: PortalSessionDto | null) {
  try {
    if (s) sessionStorage.setItem(sessionKey(slug), JSON.stringify(s));
    else sessionStorage.removeItem(sessionKey(slug));
  } catch { /* see above */ }
}

function Notice({ tone, children, onClose }: { tone: "error" | "ok"; children: React.ReactNode; onClose?: () => void }) {
  return (
    <div role={tone === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-2 rounded-lg px-3.5 py-2.5 text-sm",
        tone === "error" ? "bg-red-50 text-red-800 border border-red-200" : "bg-emerald-50 text-emerald-800 border border-emerald-200")}>
      <span className="flex-1">{children}</span>
      {onClose && <button onClick={onClose} aria-label="Dismiss" className="shrink-0 opacity-70 hover:opacity-100"><X className="h-4 w-4" /></button>}
    </div>
  );
}

function Shell({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900" style={{ colorScheme: "light" }}>
      <header className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center gap-3">
          <span className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0"><Library className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold truncate">{title}</h1>
            <p className="text-xs text-slate-500">Member portal</p>
          </div>
          {right}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-4">{children}</main>
    </div>
  );
}

// ── Sign in ─────────────────────────────────────────────────────────────────

function SignIn({ slug, onSignedIn }: { slug: string; onSignedIn: (s: PortalSessionDto) => void }) {
  const [number, setNumber] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !number.trim() || !pin.trim()) return;
    setBusy(true); setError(null);
    try { onSignedIn(await portalApi.signIn(slug, number.trim(), pin.trim())); }
    catch (err) { setError((err as Error).message); setPin(""); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 max-w-md mx-auto">
      <div>
        <h2 className="text-lg font-bold">Sign in</h2>
        <p className="text-sm text-slate-500 mt-0.5">Use the number on your library card and the PIN the library gave you.</p>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Card number</span>
        <input className={INPUT} value={number} onChange={e => setNumber(e.target.value)} autoFocus autoComplete="username" />
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">PIN</span>
        <input className={INPUT} value={pin} onChange={e => setPin(e.target.value)} type="password" inputMode="numeric"
          autoComplete="current-password" />
      </label>
      <button type="submit" className={cn(BTN_PRIMARY, "w-full")} disabled={busy || !number.trim() || !pin.trim()}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}Sign in
      </button>
      <p className="text-xs text-slate-500">No PIN, or forgotten it? Ask at the library desk and they will give you a new one.</p>
    </form>
  );
}

// ── Change PIN ──────────────────────────────────────────────────────────────

function ChangePin({ slug, token, onChanged, onClose }: {
  slug: string; token: string; onChanged: (s: PortalSessionDto) => void; onClose: () => void;
}) {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [again, setAgain] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const formatOk = /^[0-9]{4,8}$/.test(next);
  const valid = current.trim().length > 0 && formatOk && next === again;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true); setError(null);
    try { onChanged(await portalApi.changePin(slug, token, current.trim(), next)); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-5 space-y-3.5">
        <h2 className="text-lg font-bold">Change PIN</h2>
        {error && <Notice tone="error">{error}</Notice>}
        {([["Current PIN", current, setCurrent], ["New PIN (4 to 8 digits)", next, setNext], ["New PIN again", again, setAgain]] as
          [string, string, (v: string) => void][]).map(([label, value, set], i) => (
          <label key={label} className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</span>
            <input className={INPUT} type="password" inputMode="numeric" value={value} autoFocus={i === 0}
              onChange={e => set(e.target.value)} autoComplete={i === 0 ? "current-password" : "new-password"} />
          </label>
        ))}
        {next.length > 0 && !formatOk && <p className="text-xs text-red-700">A PIN is 4 to 8 digits.</p>}
        {formatOk && again.length > 0 && next !== again && <p className="text-xs text-red-700">The two new PINs do not match.</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={BTN_GHOST} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className={BTN_PRIMARY} disabled={!valid || busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}Save
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Catalogue ───────────────────────────────────────────────────────────────

function Catalogue({ slug, token, info, onReserved, onExpired }: {
  slug: string; token: string | null; info: PortalInfoDto; onReserved: () => void; onExpired: () => void;
}) {
  const [text, setText] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState<PortalTitleDto[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);
  const [reserving, setReserving] = React.useState<PortalTitleDto | null>(null);
  const [branchId, setBranchId] = React.useState(info.branches[0]?.id ?? "");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const id = setTimeout(() => { setSearch(text.trim()); setPage(1); }, 350);
    return () => clearTimeout(id);
  }, [text]);

  React.useEffect(() => {
    let stale = false;
    setLoading(true); setError(null);
    portalApi.search(slug, token, search, page)
      .then(r => { if (stale) return; setRows(prev => (page === 1 ? r.items : [...prev, ...r.items])); setTotal(r.total); })
      .catch((e: PortalError) => { if (stale) return; if (e.status === 401) onExpired(); else setError(e.message); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, token, search, page]);

  const reserve = async () => {
    if (!reserving || !token || !branchId || busy) return;
    setBusy(true); setError(null);
    try {
      const r = await portalApi.reserve(slug, token, reserving.id, branchId);
      setDone(r.status === "ready"
        ? `"${r.title}" is set aside for you at ${r.pickupBranchName}${r.holdUntil ? ` until ${formatDate(r.holdUntil)}` : ""}.`
        : `You are in the queue for "${r.title}". We will keep it for you at ${r.pickupBranchName} when a copy comes back.`);
      setReserving(null);
      onReserved();
    } catch (e) {
      const err = e as PortalError;
      if (err.status === 401) onExpired(); else setError(err.message);
      setReserving(null);
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input className={cn(INPUT, "pl-9")} placeholder="Search by title, author, subject or ISBN"
          value={text} onChange={e => setText(e.target.value)} />
      </div>

      {done && <Notice tone="ok" onClose={() => setDone(null)}>{done}</Notice>}
      {error && <Notice tone="error" onClose={() => setError(null)}>{error}</Notice>}

      {!loading && rows.length === 0 && !error && (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
          {search ? `Nothing found for "${search}".` : "The catalogue is empty."}
        </p>
      )}

      <ul className="space-y-2.5">
        {rows.map(t => (
          <li key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-snug">{t.title}{t.subtitle ? `: ${t.subtitle}` : ""}</p>
                <p className="text-sm text-slate-600 mt-0.5">
                  {[t.authors, t.publicationYear, t.category].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                t.available > 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                {t.available > 0 ? `${t.available} available` : "All out"}
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              {t.branches.map(b => (
                <span key={b.branchId}>{b.branchName}: <span className="font-semibold text-slate-700">{b.available}</span> of {b.copies}</span>
              ))}
              {t.waiting > 0 && <span>{t.waiting} waiting</span>}
            </div>
            {token && info.allowReservations && (
              <div className="mt-3">
                <button className={cn(BTN_GHOST, "h-9")} onClick={() => { setReserving(t); setDone(null); setError(null); }}>
                  <BookMarked className="h-4 w-4" />Reserve
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {loading && <p className="flex items-center justify-center gap-2 py-4 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading…</p>}
      {!loading && rows.length < total && (
        <button className={cn(BTN_GHOST, "w-full")} onClick={() => setPage(p => p + 1)}>Show more ({rows.length} of {total})</button>
      )}

      {reserving && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => !busy && setReserving(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-5 space-y-3.5">
            <h2 className="text-lg font-bold">Reserve this title</h2>
            <p className="text-sm text-slate-600">{reserving.title}</p>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Collect from</span>
              <select className={INPUT} value={branchId} onChange={e => setBranchId(e.target.value)}>
                {info.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <p className="text-xs text-slate-500">
              If a copy is on the shelf there, it is set aside for you straight away. Otherwise you join the queue.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button className={BTN_GHOST} onClick={() => setReserving(null)} disabled={busy}>Cancel</button>
              <button className={BTN_PRIMARY} onClick={reserve} disabled={busy || !branchId}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}Reserve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function LibraryPortalPage() {
  const { slug = "" } = useParams<{ slug: string }>();

  const [info, setInfo] = React.useState<PortalInfoDto | null>(null);
  const [unavailable, setUnavailable] = React.useState<string | null>(null);
  const [session, setSession] = React.useState<PortalSessionDto | null>(() => loadSession(slug));
  const [account, setAccount] = React.useState<PortalAccountDto | null>(null);
  const [tab, setTab] = React.useState<Tab>("loans");
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [changingPin, setChangingPin] = React.useState(false);
  const [confirmCancel, setConfirmCancel] = React.useState<string | null>(null);

  const token = session?.token ?? null;

  React.useEffect(() => {
    portalApi.info(slug).then(setInfo).catch((e: Error) => setUnavailable(e.message));
  }, [slug]);

  const signOut = React.useCallback((message?: string) => {
    storeSession(slug, null);
    setSession(null); setAccount(null); setTab("loans");
    setError(message ?? null); setDone(null);
  }, [slug]);

  const expired = React.useCallback(() => signOut("Your session has ended. Please sign in again."), [signOut]);

  const refresh = React.useCallback(async () => {
    if (!token) return;
    try { setAccount(await portalApi.account(slug, token)); }
    catch (e) {
      const err = e as PortalError;
      if (err.status === 401) expired(); else setError(err.message);
    }
  }, [slug, token, expired]);

  React.useEffect(() => { refresh(); }, [refresh]);

  const signedIn = (s: PortalSessionDto) => { storeSession(slug, s); setSession(s); setError(null); };

  const act = async (id: string, work: () => Promise<string>) => {
    if (busyId) return;
    setBusyId(id); setError(null); setDone(null);
    try { setDone(await work()); await refresh(); }
    catch (e) {
      const err = e as PortalError;
      if (err.status === 401) expired(); else setError(err.message);
    } finally { setBusyId(null); }
  };

  if (unavailable)
    return (
      <Shell title="Library">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center">
          <Library className="h-8 w-8 mx-auto text-slate-300" />
          <p className="mt-3 font-semibold">{unavailable}</p>
          <p className="text-sm text-slate-500 mt-1">Check the address, or ask at the library desk.</p>
        </div>
      </Shell>
    );

  if (!info)
    return <Shell title="Library"><p className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading…</p></Shell>;

  if (!session || !token)
    return (
      <Shell title={info.libraryName}>
        {error && <Notice tone="error" onClose={() => setError(null)}>{error}</Notice>}
        <SignIn slug={slug} onSignedIn={signedIn} />
        {info.publicCatalogue && (
          <section className="pt-4 space-y-3">
            <h2 className="text-sm font-bold text-slate-700">Search the catalogue</h2>
            <Catalogue slug={slug} token={null} info={info} onReserved={() => {}} onExpired={() => {}} />
          </section>
        )}
      </Shell>
    );

  const m = account?.member;
  const blocked = m ? (m.status === "suspended" ? "Your membership is suspended. Please speak to the library."
    : m.isExpired ? `Your membership expired on ${formatDate(m.expiresOn!)}. Please renew it at the library.` : null) : null;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "loans", label: "My books", count: account?.loans.length },
    { key: "reservations", label: "Reservations", count: account?.reservations.length },
    { key: "search", label: "Find a book" },
    ...(account && account.fines.length > 0 ? [{ key: "fines" as Tab, label: "Fines", count: account.fines.length }] : []),
  ];

  return (
    <Shell title={info.libraryName}
      right={
        <div className="flex items-center gap-1.5 shrink-0">
          <button className={cn(BTN_GHOST, "h-9 px-2.5")} onClick={() => setChangingPin(true)} title="Change PIN" aria-label="Change PIN">
            <KeyRound className="h-4 w-4" />
          </button>
          <button className={cn(BTN_GHOST, "h-9")} onClick={() => signOut()} aria-label="Sign out"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Sign out</span></button>
        </div>
      }>
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 flex flex-wrap items-center gap-x-6 gap-y-1">
        <div className="min-w-0">
          <p className="font-semibold truncate">{session.memberName}</p>
          <p className="text-xs text-slate-500">Card {session.memberNumber}{m ? ` · ${m.membershipType}` : ""}</p>
        </div>
        {m && (
          <p className="text-xs text-slate-500 ms-auto text-end">
            {account!.loans.length} of {m.maxLoans} books out
            {m.expiresOn && !m.isExpired ? <><br />Membership valid until {formatDate(m.expiresOn)}</> : null}
          </p>
        )}
      </div>

      {blocked && <Notice tone="error">{blocked}</Notice>}
      {account && account.finesTotal > 0 && tab !== "fines" && (
        <Notice tone="error">
          You owe {formatCurrency(account.finesTotal, info.currency ?? undefined)} in fines. They are paid at the library desk.
        </Notice>
      )}
      {error && <Notice tone="error" onClose={() => setError(null)}>{error}</Notice>}
      {done && <Notice tone="ok" onClose={() => setDone(null)}>{done}</Notice>}

      <nav className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {tabs.map(x => (
          <button key={x.key} onClick={() => { setTab(x.key); setDone(null); setError(null); }}
            className={cn("px-3.5 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap",
              tab === x.key ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800")}>
            {x.label}{x.count ? <span className="ms-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{x.count}</span> : null}
          </button>
        ))}
      </nav>

      {!account && tab !== "search" && (
        <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading…</p>
      )}

      {account && tab === "loans" && (
        account.loans.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
            <BookOpen className="h-7 w-7 mx-auto mb-2 text-slate-300" />You have no books out.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {account.loans.map(l => (
              <li key={l.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug">{l.title}</p>
                  <p className="text-sm text-slate-600">{l.authors || "—"}</p>
                  <p className={cn("mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold", l.isOverdue ? "text-red-700" : "text-slate-600")}>
                    <CalendarClock className="h-3.5 w-3.5" />
                    {l.isOverdue ? `Overdue by ${l.daysOverdue} day${l.daysOverdue === 1 ? "" : "s"} — was due ${formatDate(l.dueDate)}` : `Due ${formatDate(l.dueDate)}`}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    From {l.branchName}{m ? ` · renewed ${l.renewalCount} of ${m.maxRenewals} times` : ""}
                  </p>
                </div>
                {info.allowRenewals && (
                  <button className={cn(BTN_GHOST, "h-9")} disabled={busyId !== null}
                    onClick={() => act(l.id, async () => {
                      const r = await portalApi.renew(slug, token, l.id);
                      return `"${r.title}" is renewed. It is now due ${formatDate(r.dueDate)}.`;
                    })}>
                    {busyId === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Renew
                  </button>
                )}
              </li>
            ))}
          </ul>
        )
      )}

      {account && tab === "reservations" && (
        account.reservations.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
            <BookMarked className="h-7 w-7 mx-auto mb-2 text-slate-300" />You have no reservations.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {account.reservations.map(r => (
              <li key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug">{r.title}</p>
                  <p className={cn("mt-1 text-xs font-semibold", r.status === "ready" ? "text-emerald-700" : "text-slate-600")}>
                    {r.status === "ready"
                      ? `Ready to collect at ${r.pickupBranchName}${r.holdUntil ? ` — kept until ${formatDate(r.holdUntil)}` : ""}`
                      : `In the queue — collect from ${r.pickupBranchName}`}
                  </p>
                  {r.holdExpired && <p className="text-xs text-red-700 mt-0.5">The collection date has passed. Please contact the library.</p>}
                  <p className="text-xs text-slate-500 mt-0.5">Reserved {formatDate(r.reservedOn)}</p>
                </div>
                {confirmCancel === r.id ? (
                  <div className="flex items-center gap-2">
                    <button className={cn(BTN_GHOST, "h-9")} onClick={() => setConfirmCancel(null)} disabled={busyId !== null}>Keep</button>
                    <button className={cn(BTN, "h-9 bg-red-600 text-white hover:bg-red-700")} disabled={busyId !== null}
                      onClick={() => act(r.id, async () => {
                        await portalApi.cancelReservation(slug, token, r.id);
                        setConfirmCancel(null);
                        return `Your reservation for "${r.title}" is cancelled.`;
                      })}>
                      {busyId === r.id && <Loader2 className="h-4 w-4 animate-spin" />}Cancel it
                    </button>
                  </div>
                ) : (
                  <button className={cn(BTN_GHOST, "h-9")} onClick={() => setConfirmCancel(r.id)} disabled={busyId !== null}>Cancel</button>
                )}
              </li>
            ))}
          </ul>
        )
      )}

      {tab === "search" && <Catalogue slug={slug} token={token} info={info} onReserved={refresh} onExpired={expired} />}

      {account && tab === "fines" && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <ul className="divide-y divide-slate-200">
            {account.fines.map(f => (
              <li key={f.id} className="px-4 py-3 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold capitalize">{f.type} fine</p>
                  <p className="text-xs text-slate-500">{[f.title, f.reason, formatDate(f.createdOn)].filter(Boolean).join(" · ")}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums">{formatCurrency(f.balance, info.currency ?? undefined)}</span>
              </li>
            ))}
          </ul>
          <div className="px-4 py-3 bg-slate-50 flex items-center justify-between text-sm">
            <span className="text-slate-600">Fines are paid at the library desk.</span>
            <span className="font-bold tabular-nums">{formatCurrency(account.finesTotal, info.currency ?? undefined)}</span>
          </div>
        </div>
      )}

      {changingPin && (
        <ChangePin slug={slug} token={token} onClose={() => setChangingPin(false)}
          onChanged={s => { signedIn(s); setChangingPin(false); setDone("Your PIN is changed."); }} />
      )}
    </Shell>
  );
}
