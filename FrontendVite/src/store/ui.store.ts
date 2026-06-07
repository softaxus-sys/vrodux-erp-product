import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  sidebarCollapsed: boolean;
  sidebarMobileOpen: boolean;
  commandPaletteOpen: boolean;
  aiAssistantOpen: boolean;
  notificationPanelOpen: boolean;
  activeModule: string;

  // Actions
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarMobileOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  setAiAssistantOpen: (open: boolean) => void;
  toggleAiAssistant: () => void;
  setNotificationPanelOpen: (open: boolean) => void;
  setActiveModule: (module: string) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      sidebarMobileOpen: false,
      commandPaletteOpen: false,
      aiAssistantOpen: false,
      notificationPanelOpen: false,
      activeModule: "dashboard",

      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setSidebarMobileOpen: (open) => set({ sidebarMobileOpen: open }),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      toggleCommandPalette: () =>
        set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
      setAiAssistantOpen: (open) => set({ aiAssistantOpen: open }),
      toggleAiAssistant: () =>
        set((s) => ({ aiAssistantOpen: !s.aiAssistantOpen })),
      setNotificationPanelOpen: (open) =>
        set({ notificationPanelOpen: open }),
      setActiveModule: (module) => set({ activeModule: module }),
    }),
    {
      name: "softaxis-ui",
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        activeModule: state.activeModule,
      }),
    }
  )
);
