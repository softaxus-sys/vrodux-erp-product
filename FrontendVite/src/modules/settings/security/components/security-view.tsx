import { TwoFactorCard } from "./two-factor-card";

export function SecurityView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Security</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Protect your account with an extra layer of sign-in security.
        </p>
      </div>
      <div className="max-w-2xl">
        <TwoFactorCard />
      </div>
    </div>
  );
}
