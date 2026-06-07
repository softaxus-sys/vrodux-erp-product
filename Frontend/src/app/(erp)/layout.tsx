import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/layout/command-palette";
import { NotificationPanel } from "@/components/layout/notification-panel";
import { AiAssistantPanel } from "@/components/layout/ai-assistant-panel";

export default function ErpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-auto">
          <div className="p-6 animate-fade-in">{children}</div>
        </main>
      </div>
      {/* Global overlays */}
      <CommandPalette />
      <NotificationPanel />
      <AiAssistantPanel />
    </div>
  );
}
