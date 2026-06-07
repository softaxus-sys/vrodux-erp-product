"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, User, Lock, Shield, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/store/auth.store";
import { authApi } from "@/lib/identity/auth.api";

type Tab = "profile" | "security";

export function ProfileView() {
  const { user, updateUser } = useAuthStore();
  const [tab, setTab] = React.useState<Tab>("profile");

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">My Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your personal details and security settings</p>
      </div>

      {/* Avatar card */}
      <div className="bg-card border border-border rounded-2xl p-6 flex items-center gap-4">
        <div className="relative">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user?.avatar} alt={user?.name} />
            <AvatarFallback className="text-lg bg-primary text-primary-foreground font-bold">
              {user?.name?.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-1">
            <Camera className="w-3 h-3" />
          </div>
        </div>
        <div>
          <p className="font-bold text-base">{user?.name}</p>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          <p className="text-xs text-muted-foreground capitalize">{user?.role?.replace(/_/g, " ")}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-xl w-fit">
        {([
          { key: "profile" as Tab, label: "Profile Info", icon: User },
          { key: "security" as Tab, label: "Security",    icon: Lock },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "profile" && <ProfileInfoTab />}
      {tab === "security" && <SecurityTab />}
    </div>
  );
}

// ── Profile Info Tab ──────────────────────────────────────────────────────────

function ProfileInfoTab() {
  const { updateUser } = useAuthStore();

  const { data: me, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn:  () => authApi.getMe(),
    staleTime: 60_000,
  });

  const [firstName, setFirstName]     = React.useState("");
  const [lastName, setLastName]       = React.useState("");
  const [phoneNumber, setPhone]       = React.useState("");
  const [avatarUrl, setAvatarUrl]     = React.useState("");

  React.useEffect(() => {
    if (me) {
      setFirstName(me.firstName);
      setLastName(me.lastName);
      setPhone(me.phoneNumber ?? "");
      setAvatarUrl(me.avatarUrl ?? "");
    }
  }, [me]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => authApi.updateMe({
      firstName: firstName.trim(),
      lastName:  lastName.trim(),
      phoneNumber: phoneNumber.trim() || null,
      avatarUrl:   avatarUrl.trim() || null,
    }),
    onSuccess: (updated) => {
      updateUser(updated);
      toast.success("Profile updated successfully.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
      <h2 className="text-sm font-bold flex items-center gap-2">
        <User className="w-4 h-4 text-primary" /> Personal Information
      </h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">First Name</label>
          <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" className="h-9 text-sm" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Last Name</label>
          <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" className="h-9 text-sm" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</label>
          <Input value={me?.email ?? ""} disabled className="h-9 text-sm opacity-60" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone</label>
          <Input value={phoneNumber} onChange={e => setPhone(e.target.value)} placeholder="+92 300 000 0000" className="h-9 text-sm" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Avatar URL</label>
          <Input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://…" className="h-9 text-sm" />
        </div>
      </div>
      <div className="flex justify-end pt-1">
        <Button onClick={() => save()} disabled={isPending}>
          {isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</> : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

function RoleBadge() {
  const role = useAuthStore(s => s.user?.role);
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
        {role?.replace(/_/g, " ") ?? "—"}
      </span>
    </div>
  );
}

// ── Security Tab ──────────────────────────────────────────────────────────────

function SecurityTab() {
  const { logout } = useAuthStore();
  const [current, setCurrent]     = React.useState("");
  const [newPass, setNewPass]     = React.useState("");
  const [confirm, setConfirm]     = React.useState("");

  const { mutate: changePassword, isPending } = useMutation({
    mutationFn: () => authApi.changePassword(current, newPass),
    onSuccess: () => {
      toast.success("Password changed. Please sign in again.");
      setCurrent(""); setNewPass(""); setConfirm("");
      // Sign out after password change — force fresh login
      setTimeout(() => logout(), 1500);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isValid = current && newPass.length >= 8 && newPass === confirm;

  return (
    <div className="space-y-4">
      {/* Change password */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-bold flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary" /> Change Password
        </h2>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Current Password</label>
            <Input type="password" value={current} onChange={e => setCurrent(e.target.value)} placeholder="Enter current password" className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Password</label>
            <Input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="At least 8 characters" className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Confirm New Password</label>
            <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat new password" className="h-9 text-sm" />
            {confirm && newPass !== confirm && (
              <p className="text-[11px] text-destructive">Passwords do not match.</p>
            )}
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => changePassword()} disabled={!isValid || isPending}>
            {isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Changing…</> : "Change Password"}
          </Button>
        </div>
      </div>

      {/* Permissions (read-only) */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
        <h2 className="text-sm font-bold flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" /> Roles & Permissions
        </h2>
        <RoleBadge />
        <p className="text-xs text-muted-foreground">Role and permissions are managed by your administrator.</p>
      </div>
    </div>
  );
}
