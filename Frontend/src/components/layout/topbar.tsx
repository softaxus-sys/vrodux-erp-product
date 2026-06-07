"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Search, Sun, Moon, Monitor, ChevronDown, LogOut, Settings, User, Sparkles } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui.store";
import { useAuthStore } from "@/store/auth.store";
import { useNotificationsStore } from "@/store/notifications.store";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  return segments.map((seg, i) => ({
    label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " "),
    href: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          {theme === "dark" ? (
            <Moon className="h-4 w-4" />
          ) : theme === "light" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Monitor className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="mr-2 h-4 w-4" /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationsButton() {
  const { unreadCount } = useNotificationsStore();
  const { setNotificationPanelOpen, notificationPanelOpen } = useUiStore();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 relative"
      onClick={() => setNotificationPanelOpen(!notificationPanelOpen)}
    >
      <Bell className="h-4 w-4" />
      {unreadCount > 0 && (
        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive animate-pulse-slow" />
      )}
    </Button>
  );
}

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, tenant, logout } = useAuthStore();
  const { toggleCommandPalette, toggleAiAssistant } = useUiStore();

  const handleLogout = async () => {
    await logout();
    router.push("/auth/login");
  };
  const breadcrumbs = getBreadcrumbs(pathname);

  return (
    <header className="h-16 border-b border-border bg-background/95 backdrop-blur-sm flex items-center px-4 gap-4 shrink-0 sticky top-0 z-40">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-sm flex-1 min-w-0">
        <span className="text-muted-foreground font-medium truncate">
          {tenant?.name ?? "Softaxis ERP"}
        </span>
        {breadcrumbs.map((crumb, i) => (
          <React.Fragment key={crumb.href}>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50 rotate-[-90deg] shrink-0" />
            <span
              className={cn(
                "truncate",
                crumb.isLast
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              )}
            >
              {crumb.label}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Command palette trigger */}
        <Button
          variant="outline"
          className="hidden md:flex h-9 gap-2 text-sm text-muted-foreground pr-2 pl-3"
          onClick={toggleCommandPalette}
        >
          <Search className="h-3.5 w-3.5" />
          <span className="text-xs hidden lg:block">Search everything...</span>
          <kbd className="pointer-events-none ml-2 hidden h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 lg:flex">
            ⌘K
          </kbd>
        </Button>

        {/* AI Assistant */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-primary"
          onClick={toggleAiAssistant}
        >
          <Sparkles className="h-4 w-4" />
        </Button>

        <NotificationsButton />
        <ThemeToggle />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 h-9 pl-1 pr-2"
            >
              <Avatar className="h-7 w-7">
                <AvatarImage src={user?.avatar} alt={user?.name} />
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {user?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start text-left">
                <span className="text-xs font-semibold leading-tight">{user?.name}</span>
                <span className="text-[10px] text-muted-foreground capitalize leading-tight">
                  {user?.role?.replace(/_/g, " ")}
                </span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              <div>
                <p className="font-semibold text-sm">{user?.name}</p>
                <p className="text-xs text-muted-foreground font-normal">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/profile")}>
              <User className="mr-2 h-4 w-4" /> My Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/settings/general")}>
              <Settings className="mr-2 h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
