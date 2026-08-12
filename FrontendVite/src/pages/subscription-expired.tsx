import { useEffect, useState } from "react";
import { AlertTriangle, Clock, CreditCard, Mail, PhoneCall, RefreshCw, ShieldOff } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubError {
  code: string;
  message: string;
}

const CODE_META: Record<
  string,
  { title: string; icon: React.ElementType; color: string; accent: string }
> = {
  SUBSCRIPTION_EXPIRED: {
    title:  "Subscription Expired",
    icon:   Clock,
    color:  "text-amber-500",
    accent: "bg-amber-50 border-amber-200",
  },
  LICENSE_EXPIRED: {
    title:  "License Expired",
    icon:   ShieldOff,
    color:  "text-red-500",
    accent: "bg-red-50 border-red-200",
  },
  LICENSE_NOT_ISSUED: {
    title:  "No License Issued",
    icon:   ShieldOff,
    color:  "text-red-500",
    accent: "bg-red-50 border-red-200",
  },
  ACCOUNT_SUSPENDED: {
    title:  "Account Suspended",
    icon:   AlertTriangle,
    color:  "text-red-600",
    accent: "bg-red-50 border-red-200",
  },
  TRIAL_EXPIRED: {
    title:  "Free Trial Ended",
    icon:   Clock,
    color:  "text-orange-500",
    accent: "bg-orange-50 border-orange-200",
  },
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SubscriptionExpiredPage() {
  const logout = useAuthStore((s) => s.logout);
  const [error, setError] = useState<SubError | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("sub_error");
      if (raw) setError(JSON.parse(raw) as SubError);
    } catch {
      // ignore
    }
  }, []);

  const meta =
    error?.code && CODE_META[error.code]
      ? CODE_META[error.code]
      : {
          title:  "Access Blocked",
          icon:   ShieldOff,
          color:  "text-gray-500",
          accent: "bg-gray-50 border-gray-200",
        };

  const Icon = meta.icon;

  function handleLogout() {
    sessionStorage.removeItem("sub_error");
    logout();
    window.location.replace("/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg overflow-hidden">

        {/* Header stripe */}
        <div className="h-2 bg-gradient-to-r from-primary to-primary/60" />

        <div className="p-8 text-center">

          {/* Icon */}
          <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full border-2 mb-6 ${meta.accent}`}>
            <Icon className={`w-10 h-10 ${meta.color}`} />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">{meta.title}</h1>

          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            {error?.message ??
              "Your subscription has expired or is no longer valid. Please contact Vrodux support to renew your plan and restore access."}
          </p>

          {/* Error code badge */}
          {error?.code && (
            <div className="inline-block px-3 py-1 rounded-full text-xs font-mono font-medium bg-gray-100 text-gray-500 mb-6">
              {error.code}
            </div>
          )}

          {/* Self-serve reactivation — the whole point of blocking rather than deleting.
              /settings/billing is exempt from subscription enforcement, so this always loads. */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 mb-4 text-left">
            <p className="text-sm font-semibold text-gray-800 mb-1">Reactivate in a minute</p>
            <p className="text-xs text-gray-600 mb-3">
              Your data is safe and untouched — nothing has been deleted. Choose a plan and full
              access comes straight back.
            </p>
            <button
              onClick={() => { window.location.href = "/settings/billing"; }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              Choose a plan
            </button>
          </div>

          {/* Contact info */}
          <div className={`rounded-xl border p-4 mb-6 text-left space-y-2 ${meta.accent}`}>
            <p className="text-xs font-semibold text-gray-600 mb-3">Contact Vrodux Support</p>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail className="w-4 h-4 flex-shrink-0" />
              <a href="mailto:support@softaxis.com" className="hover:underline">
                support@softaxis.com
              </a>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <PhoneCall className="w-4 h-4 flex-shrink-0" />
              <span>+971 56 938 3079 / +92 314 951 1674</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
