import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  THEME_PALETTES,
  DEFAULT_PALETTE_ID,
  DEFAULT_LAYOUT,
  type LayoutVariant,
  type ThemePalette,
} from "@/config/themes";

interface ThemeState {
  paletteId:     string;
  layoutVariant: LayoutVariant;
  darkMode:      boolean;
  radius:        number; // 0–1 rem

  // Derived helpers
  palette: ThemePalette;

  // Actions
  setPalette:       (id: string)               => void;
  setLayoutVariant: (variant: LayoutVariant)   => void;
  setDarkMode:      (dark: boolean)            => void;
  toggleDarkMode:   ()                         => void;
  setRadius:        (r: number)                => void;

  // Backend sync
  loadFromApi: (settings: { paletteId?: string; layoutVariant?: LayoutVariant; darkMode?: boolean; radius?: number }) => void;

  /** Reset to factory defaults — call on logout so the next user starts clean. */
  reset: () => void;
}

function getPalette(id: string): ThemePalette {
  return THEME_PALETTES.find((p) => p.id === id) ?? THEME_PALETTES[0]!;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      paletteId:     DEFAULT_PALETTE_ID,
      layoutVariant: DEFAULT_LAYOUT,
      darkMode:      false,
      radius:        0.6,
      palette:       getPalette(DEFAULT_PALETTE_ID),

      setPalette: (id) =>
        set({ paletteId: id, palette: getPalette(id) }),

      setLayoutVariant: (variant) =>
        set({ layoutVariant: variant }),

      setDarkMode: (dark) =>
        set({ darkMode: dark }),

      toggleDarkMode: () =>
        set((s) => ({ darkMode: !s.darkMode })),

      setRadius: (r) =>
        set({ radius: r }),

      reset: () =>
        set({
          paletteId:     DEFAULT_PALETTE_ID,
          layoutVariant: DEFAULT_LAYOUT,
          darkMode:      false,
          radius:        0.6,
          palette:       getPalette(DEFAULT_PALETTE_ID),
        }),

      loadFromApi: (settings) => {
        const paletteId     = settings.paletteId     ?? get().paletteId;
        const layoutVariant = settings.layoutVariant ?? get().layoutVariant;
        const darkMode      = settings.darkMode      ?? get().darkMode;
        const radius        = settings.radius        ?? get().radius;
        set({
          paletteId,
          layoutVariant,
          darkMode,
          radius,
          palette: getPalette(paletteId),
        });
      },
    }),
    {
      name:    "softaxis-theme",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        paletteId:     state.paletteId,
        layoutVariant: state.layoutVariant,
        darkMode:      state.darkMode,
        radius:        state.radius,
      }),
      // Re-derive palette after hydration
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.palette = getPalette(state.paletteId);
        }
      },
    }
  )
);
