import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { authApi } from "@/lib/identity/auth.api";
import { useAuthStore } from "@/store/auth.store";

/** Where Microsoft sends people back to (via our server). Swaps the one-time code for a session. */
export default function SsoCompletePage() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { loginFromApi } = useAuthStore();
  const [error, setError] = React.useState<string | null>(sp.get("error"));
  const ran = React.useRef(false);

  React.useEffect(() => {
    const code = sp.get("code");
    if (ran.current || error) return;
    ran.current = true;   // a one-time code can be spent once; StrictMode would otherwise run this twice
    if (!code) { setError("The sign-in link is incomplete. Please try again."); return; }
    authApi.microsoftExchange(code)
      .then(res => {
        if (!res.user) throw new Error("Sign-in did not return a user.");
        loginFromApi(res.accessToken, res.refreshToken, res.user);
        toast.success(`Welcome back, ${res.user.firstName}`);
        nav("/dashboard", { replace: true });
      })
      .catch((e: Error) => setError(e.message || "Microsoft sign-in failed."));
  }, [sp, error, loginFromApi, nav]);

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-background">
      <div className="max-w-sm w-full rounded-2xl border border-border bg-card p-8 text-center">
        {error ? (
          <>
            <AlertTriangle className="size-9 text-destructive mx-auto mb-3" />
            <h1 className="font-bold text-lg">We couldn't sign you in</h1>
            <p className="text-sm text-muted-foreground mt-2">{error}</p>
            <Link to="/auth/login" className="inline-block mt-5 text-sm font-semibold text-primary hover:underline">Back to sign in</Link>
          </>
        ) : (
          <>
            <Loader2 className="size-8 animate-spin text-primary mx-auto mb-3" />
            <p className="font-medium">Finishing your Microsoft sign-in…</p>
          </>
        )}
      </div>
    </div>
  );
}
