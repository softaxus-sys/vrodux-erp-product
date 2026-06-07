import * as React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useThemeStore } from "@/store/theme.store";
import { useTenantBootstrap } from "@/hooks/use-tenant-bootstrap";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/layout/command-palette";
import { NotificationPanel } from "@/components/layout/notification-panel";
import { AiAssistantPanel } from "@/components/layout/ai-assistant-panel";
import { SidebarLeftLayout }  from "./sidebar-left-layout";
import { SidebarRightLayout } from "./sidebar-right-layout";
import { TopNavLayout }       from "./top-nav-layout";
import { MiniRailLayout }     from "./mini-rail-layout";

/**
 * Content area shared by all layouts: topbar + page body.
 *
 * POS routes (/pos/*) are full-screen terminal UIs — they manage their own
 * internal scroll regions. For these routes we:
 *   • Remove the p-6 padding wrapper (POS has its own spacing)
 *   • Switch main from overflow-auto → overflow-hidden so h-full in POS
 *     children resolves to the flex-1 size, not auto (which breaks inner scroll)
 */
function PageContent() {
  const { pathname } = useLocation();
  const isPOS = pathname.startsWith("/pos/");

  return (
    <>
      <Topbar />
      {isPOS ? (
        <main className="flex-1 overflow-hidden flex flex-col min-h-0">
          <Outlet />
        </main>
      ) : (
        <main className="flex-1 overflow-auto">
          <div className="p-6 animate-fade-in">
            <Outlet />
          </div>
        </main>
      )}
      <CommandPalette />
      <NotificationPanel />
      <AiAssistantPanel />
    </>
  );
}

/** Picks the right shell based on the active layout variant */
export function ErpLayout() {
  const { layoutVariant } = useThemeStore();
  useTenantBootstrap();

  switch (layoutVariant) {
    case "sidebar-right":
      return <SidebarRightLayout><PageContent /></SidebarRightLayout>;
    case "top-nav":
      return <TopNavLayout><PageContent /></TopNavLayout>;
    case "mini-rail":
      return <MiniRailLayout><PageContent /></MiniRailLayout>;
    case "sidebar-left":
    default:
      return <SidebarLeftLayout><PageContent /></SidebarLeftLayout>;
  }
}
