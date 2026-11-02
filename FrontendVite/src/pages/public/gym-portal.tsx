import * as React from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, Dumbbell, KeyRound, Loader2, LogOut, Receipt, UserRound, X } from "lucide-react";
import {
  portalApi, PortalError,
  type PortalAccountDto, type PortalClassDto, type PortalInfoDto, type PortalSessionDto,
} from "@/lib/fitness/portal.api";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

/**
 * The page a gym member opens to see their membership, book classes and see what they have paid.
 * No staff sign-in, no app layout, no auth store and no theme: a member is not a user of the
 * application. They sign in with their member number and the PIN the gym gave them.
 *
 * English only for now, because the member's language is not the gym's interface language.
 */

type Tab = "membership" | "classes" | "payments" | "visits";

const BTN = "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 h-10 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_PRIMARY = cn(BTN, "bg-indigo-600 text-white hover:bg-indigo-700");
const BTN_GHOST = cn(BTN, "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50");
const INPUT = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500";

const sessionKey = (slug: string) => `gym-portal:${slug}`;

// Storage can be unavailable (private window, blocked site data); the page still works, it just
// asks for the PIN again after a reload.
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
        <div className="mx-auto max-w-3xl px-4 h-14 flex items-center gap-3">
          <Dumbbell className="h-5 w-5 text-indigo-600 shrink-0" />
          <h1 className="font-semibold truncate flex-1">{title}</h1>
          {right}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5 space-y-4">{children}</main>
    </div>
  );
}

const STATE_LABEL: Record<string, string> = {
  active: "Active", expiring: "Ending soon", expired: "Expired", frozen: "Frozen", upcoming: "Starts soon", cancelled: "Cancelled",
};
const STATE_TONE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800", expiring: "bg-amber-100 text-amber-800", expired: "bg-red-100 text-red-800",
  frozen: "bg-sky-100 text-sky-800", upcoming: "bg-slate-100 text-slate-700",
};

function SignIn({ slug, info, onSession }: { slug: string; info: PortalInfoDto; onSession: (s: PortalSessionDto) => void }) {
  const [number, setNumber] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { onSession(await portalApi.signIn(slug, number.trim(), pin.trim())); }
    catch (err) { setError(err instanceof PortalError ? err.message : "Could not sign in."); }
    finally { setBusy(false); }
  };

  return (
    <Shell title={info.gymName}>
      <form onSubmit={submit} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 max-w-sm mx-auto mt-6">
        <div className="text-center space-y-1">
          <div className="mx-auto h-11 w-11 rounded-full bg-indigo-50 text-indigo-600 grid place-items-center"><UserRound className="h-5 w-5" /></div>
          <h2 className="font-semibold">Member sign in</h2>
          <p className="text-xs text-slate-500">Use the member number and PIN from the front desk.</p>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <label className="block space-y-1"><span className="text-xs font-semibold text-slate-600">Member number</span>
          <input className={INPUT} value={number} onChange={e => setNumber(e.target.value)} autoComplete="username" autoCapitalize="characters" required /></label>
        <label className="block space-y-1"><span className="text-xs font-semibold text-slate-600">PIN</span>
          <input className={INPUT} value={pin} onChange={e => setPin(e.target.value)} type="password" inputMode="numeric" autoComplete="current-password" required /></label>
        <button type="submit" className={cn(BTN_PRIMARY, "w-full")} disabled={busy || !number.trim() || !pin.trim()}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}Sign in
        </button>
      </form>
    </Shell>
  );
}

function ChangePin({ slug, session, onSession, onDone }: {
  slug: string; session: PortalSessionDto; onSession: (s: PortalSessionDto) => void; onDone: () => void;
}) {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { onSession(await portalApi.changePin(slug, session.token, current.trim(), next.trim())); onDone(); }
    catch (err) { setError(err instanceof PortalError ? err.message : "Could not change the PIN."); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <h3 className="font-semibold text-sm">Change PIN</h3>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="grid sm:grid-cols-2 gap-3">
        <input className={INPUT} type="password" inputMode="numeric" placeholder="Current PIN" value={current} onChange={e => setCurrent(e.target.value)} required />
        <input className={INPUT} type="password" inputMode="numeric" placeholder="New PIN (4 to 8 digits)" value={next} onChange={e => setNext(e.target.value)} required />
      </div>
      <div className="flex gap-2">
        <button type="submit" className={BTN_PRIMARY} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save PIN</button>
        <button type="button" className={BTN_GHOST} onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function Account({ slug, info, session, onSession, onSignOut }: {
  slug: string; info: PortalInfoDto; session: PortalSessionDto; onSession: (s: PortalSessionDto) => void; onSignOut: () => void;
}) {
  const [tab, setTab] = React.useState<Tab>("membership");
  const [acct, setAcct] = React.useState<PortalAccountDto | null>(null);
  const [classes, setClasses] = React.useState<PortalClassDto[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [pinOpen, setPinOpen] = React.useState(false);
  const cur = info.currency ?? undefined;

  const fail = React.useCallback((err: unknown) => {
    // A 401 means the session ended (PIN changed or removed, or it timed out): go back to sign in.
    if (err instanceof PortalError && err.status === 401) { onSignOut(); return; }
    setError(err instanceof PortalError ? err.message : "Something went wrong. Please try again.");
  }, [onSignOut]);

  const loadAccount = React.useCallback(async () => {
    try { setAcct(await portalApi.account(slug, session.token)); } catch (e) { fail(e); }
  }, [slug, session.token, fail]);
  const loadClasses = React.useCallback(async () => {
    try { setClasses(await portalApi.classes(slug, session.token)); } catch (e) { fail(e); }
  }, [slug, session.token, fail]);

  React.useEffect(() => { void loadAccount(); }, [loadAccount]);
  React.useEffect(() => { if (tab === "classes") void loadClasses(); }, [tab, loadClasses]);

  const act = async (id: string, work: () => Promise<unknown>, done: string) => {
    setBusyId(id); setError(null); setOk(null);
    try { await work(); setOk(done); await Promise.all([loadAccount(), loadClasses()]); }
    catch (e) { fail(e); }
    finally { setBusyId(null); }
  };

  const bookingFor = (sessionId: string) => acct?.bookings.find(b => b.sessionId === sessionId);

  return (
    <Shell title={info.gymName} right={
      <button onClick={onSignOut} className="text-sm text-slate-600 hover:text-slate-900 inline-flex items-center gap-1.5"><LogOut className="h-4 w-4" />Sign out</button>}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{session.fullName}</p>
          <p className="text-xs text-slate-500">Member {session.memberNumber}</p>
        </div>
        <button className={BTN_GHOST} onClick={() => setPinOpen(o => !o)}><KeyRound className="h-4 w-4" />PIN</button>
      </div>

      {pinOpen && <ChangePin slug={slug} session={session} onSession={onSession} onDone={() => setPinOpen(false)} />}
      {error && <Notice tone="error" onClose={() => setError(null)}>{error}</Notice>}
      {ok && <Notice tone="ok" onClose={() => setOk(null)}>{ok}</Notice>}

      {acct && acct.balance > 0 && (
        <Notice tone="error">You owe {formatCurrency(acct.balance, cur)}. Please settle it at the front desk.</Notice>
      )}

      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {([["membership", "Membership"], ["classes", "Classes"], ["payments", "Payments"], ["visits", "Visits"]] as [Tab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={cn("px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap",
              tab === k ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800")}>{label}</button>
        ))}
      </div>

      {!acct ? <div className="py-10 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div> : (
        <>
          {tab === "membership" && (
            <div className="space-y-3">
              {acct.memberships.length === 0 && <p className="text-sm text-slate-500">No membership yet. Ask at the front desk.</p>}
              {acct.memberships.map(m => (
                <div key={m.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold flex-1">{m.planName}</p>
                    <span className={cn("text-xs font-semibold rounded-full px-2.5 py-0.5", STATE_TONE[m.state] ?? "bg-slate-100 text-slate-700")}>{STATE_LABEL[m.state] ?? m.state}</span>
                  </div>
                  <p className="text-sm text-slate-600">{formatDate(m.startDate)} to {formatDate(m.endDate)}</p>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
                    {m.classCreditsLeft !== null && <span>Class credits left: <b className="text-slate-900">{m.classCreditsLeft}</b></span>}
                    {m.ptSessionsLeft > 0 && <span>Training sessions left: <b className="text-slate-900">{m.ptSessionsLeft}</b></span>}
                    {m.balance > 0 && <span className="text-red-700">Owed: <b>{formatCurrency(m.balance, cur)}</b></span>}
                  </div>
                </div>
              ))}
              <p className="text-xs text-slate-500">
                {acct.visits30Days} visit{acct.visits30Days === 1 ? "" : "s"} in the last 30 days
                {acct.lastVisit ? ` · last on ${formatDate(acct.lastVisit)}` : ""}
                {acct.trainerName ? ` · trainer ${acct.trainerName}` : ""}
              </p>
            </div>
          )}

          {tab === "classes" && (
            <div className="space-y-2">
              {!info.allowBooking && <Notice tone="ok">Booking online is switched off. Please book at the front desk.</Notice>}
              {classes === null ? <div className="py-8 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
                : classes.length === 0 ? <p className="text-sm text-slate-500">No classes are scheduled yet.</p>
                : classes.map(c => {
                  const booking = bookingFor(c.id);
                  return (
                    <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center gap-3">
                      <CalendarDays className="h-5 w-5 text-indigo-600 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{c.className}</p>
                        <p className="text-xs text-slate-500">
                          {formatDate(c.date)} · {c.startTime} to {c.endTime}{c.trainerName ? ` · ${c.trainerName}` : ""}{c.branchName ? ` · ${c.branchName}` : ""}
                        </p>
                        <p className="text-xs text-slate-500">
                          {c.seatsLeft > 0 ? `${c.seatsLeft} seat${c.seatsLeft === 1 ? "" : "s"} left` : `Full${c.waitlisted ? `, ${c.waitlisted} waiting` : ""}`}
                        </p>
                      </div>
                      {booking ? (
                        <button className={BTN_GHOST} disabled={busyId === booking.id}
                          onClick={() => act(booking.id, () => portalApi.cancel(slug, session.token, booking.id),
                            booking.status === "waitlisted" ? "You left the waitlist." : "Booking cancelled.")}>
                          {busyId === booking.id && <Loader2 className="h-4 w-4 animate-spin" />}
                          {booking.status === "waitlisted" ? `Waitlist #${booking.waitlistPosition ?? ""}` : "Cancel"}
                        </button>
                      ) : info.allowBooking && (
                        <button className={BTN_PRIMARY} disabled={busyId === c.id}
                          onClick={() => act(c.id, () => portalApi.book(slug, session.token, c.id),
                            c.seatsLeft > 0 ? "You are booked in." : "You are on the waitlist.")}>
                          {busyId === c.id && <Loader2 className="h-4 w-4 animate-spin" />}{c.seatsLeft > 0 ? "Book" : "Join waitlist"}
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          )}

          {tab === "payments" && (
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              {acct.payments.length === 0 && <p className="p-4 text-sm text-slate-500">No payments yet.</p>}
              {acct.payments.map(p => (
                <div key={p.receiptNumber} className="p-3.5 flex items-center gap-3">
                  <Receipt className="h-4 w-4 text-slate-400 shrink-0" />
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium">{p.receiptNumber}</p>
                    <p className="text-xs text-slate-500">{formatDate(p.paidOn)} · {p.method.replace("_", " ")}</p></div>
                  <p className="font-semibold tabular-nums">{formatCurrency(p.amount, cur)}</p>
                </div>
              ))}
            </div>
          )}

          {tab === "visits" && (
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              {acct.visits.length === 0 && <p className="p-4 text-sm text-slate-500">No visits yet.</p>}
              {acct.visits.map((v, i) => (
                <div key={i} className="p-3.5 text-sm flex justify-between">
                  <span>{formatDate(v.checkedInAt)}</span><span className="text-slate-500">{v.branchName ?? ""}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Shell>
  );
}

export default function GymPortalPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [info, setInfo] = React.useState<PortalInfoDto | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [session, setSession] = React.useState<PortalSessionDto | null>(() => loadSession(slug));

  React.useEffect(() => {
    let live = true;
    portalApi.info(slug).then(i => { if (live) setInfo(i); })
      .catch(e => { if (live) setProblem(e instanceof PortalError ? e.message : "Could not open this page."); });
    return () => { live = false; };
  }, [slug]);

  const update = React.useCallback((s: PortalSessionDto | null) => { storeSession(slug, s); setSession(s); }, [slug]);

  if (problem) return <Shell title="Member portal"><Notice tone="error">{problem}</Notice></Shell>;
  if (!info) return <Shell title="Member portal"><div className="py-16 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div></Shell>;
  if (!session) return <SignIn slug={slug} info={info} onSession={update} />;
  return <Account slug={slug} info={info} session={session} onSession={update} onSignOut={() => update(null)} />;
}
