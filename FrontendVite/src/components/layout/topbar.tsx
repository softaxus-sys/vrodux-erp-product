import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Bell, Search, Sun, Moon, Monitor, ChevronDown,
  LogOut, Settings, User, Sparkles, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { useUiStore } from "@/store/ui.store";
import { useAuthStore } from "@/store/auth.store";
import { useNotificationsStore } from "@/store/notifications.store";
import { useThemeStore } from "@/store/theme.store";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  return segments.map((seg, i) => ({
    label:  seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " "),
    href:   "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));
}

function ThemeToggle() {
  const { t } = useTranslation("common");
  const { darkMode, toggleDarkMode } = useThemeStore();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
          {darkMode
            ? <Moon className="h-4 w-4 text-muted-foreground" />
            : <Sun className="h-4 w-4 text-muted-foreground" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={toggleDarkMode}>
          {darkMode
            ? <><Sun className="me-2 h-4 w-4" />{t("theme.lightMode")}</>
            : <><Moon className="me-2 h-4 w-4" />{t("theme.darkMode")}</>}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => {
          const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          if (prefersDark !== darkMode) toggleDarkMode();
        }}>
          <Monitor className="me-2 h-4 w-4" />{t("theme.matchSystem")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationsButton() {
  const { unreadCount } = useNotificationsStore();
  const { setNotificationPanelOpen, notificationPanelOpen } = useUiStore();
  return (
    <button
      onClick={() => setNotificationPanelOpen(!notificationPanelOpen)}
      className="relative h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150"
    >
      <Bell className="h-4 w-4" />
      {unreadCount > 0 && (
        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive ring-2 ring-background animate-pulse" />
      )}
    </button>
  );
}

export function Topbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation("topbar");
  const { user, tenant, logout } = useAuthStore();
  const { toggleCommandPalette, toggleAiAssistant } = useUiStore();
  const breadcrumbs = getBreadcrumbs(pathname);

  const handleLogout = async () => {
    await logout();
    navigate("/auth/login", { replace: true });
  };

  const initials = user?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2) ?? "SA";

  return (
    <header className="h-[60px] flex items-center px-5 gap-4 shrink-0 sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-xl">

      {/* ── Breadcrumbs ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <span className="text-sm font-medium text-muted-foreground/70 truncate hidden sm:block">
          {tenant?.name ?? "Vrodux"}
        </span>
        {breadcrumbs.map((crumb) => (
          <React.Fragment key={crumb.href}>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
            <span
              className={cn(
                "text-sm truncate",
                crumb.isLast
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              )}
              onClick={() => !crumb.isLast && navigate(crumb.href)}
            >
              {crumb.label}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* ── Actions ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5">

        {/* Search pill */}
        <button
          onClick={toggleCommandPalette}
          className="hidden md:flex items-center gap-2.5 h-8 pl-3 pr-2 rounded-lg border border-border/80 bg-muted/30 hover:bg-muted/60 hover:border-border text-muted-foreground text-sm transition-all duration-150 group"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden lg:block text-xs">{t("search")}</span>
          <kbd className="hidden lg:flex ml-1 h-5 select-none items-center gap-0.5 rounded border border-border/60 bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground/60">
            ⌘K
          </kbd>
        </button>

        {/* AI */}
        <button
          onClick={toggleAiAssistant}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/8 transition-all duration-150"
        >
          <Sparkles className="h-4 w-4" />
        </button>

        <NotificationsButton />
        <LanguageSwitcher />
        <ThemeToggle />

        {/* Divider */}
        <div className="h-5 w-px bg-border/60 mx-0.5" />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 h-8 pl-1 pr-2 rounded-lg hover:bg-muted/50 transition-all duration-150 group">
              <div className="relative">
                <Avatar className="h-6 w-6 ring-2 ring-primary/20 ring-offset-1 ring-offset-background">
                  <AvatarImage src={user?.avatar} alt={user?.name} />
                  <AvatarFallback
                    className="text-[10px] font-bold"
                    style={{ background: "hsl(var(--primary)/0.15)", color: "hsl(var(--primary))" }}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-success ring-1 ring-background" />
              </div>
              <div className="hidden md:flex flex-col items-start text-left">
                <span className="text-xs font-semibold leading-tight text-foreground">{user?.name}</span>
                <span className="text-[10px] text-muted-foreground capitalize leading-tight">
                  {user?.roleName ?? user?.role?.replace(/_/g, " ")}
                </span>
              </div>
              <ChevronDown className="h-3 w-3 text-muted-foreground/50 ml-0.5 group-hover:text-muted-foreground transition-colors" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="pb-2">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.avatar} />
                  <AvatarFallback
                    className="text-xs font-bold"
                    style={{ background: "hsl(var(--primary)/0.15)", color: "hsl(var(--primary))" }}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-sm leading-tight">{user?.name}</p>
                  <p className="text-xs text-muted-foreground font-normal leading-tight mt-0.5">{user?.email}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/profile")}>
              <User className="me-2 h-4 w-4" />{t("myProfile")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings/appearance")}>
              <Settings className="me-2 h-4 w-4" />{t("appearance")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings/general")}>
              <Settings className="me-2 h-4 w-4" />{t("settings")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleLogout}>
              <LogOut className="me-2 h-4 w-4" />{t("signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
