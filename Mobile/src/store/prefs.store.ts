import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { getSecureItem, setSecureItem, deleteSecureItem } from "@/lib/secure-storage";

/**
 * This phone's own preferences -- how the app looks and which first-run things it has already shown.
 * Deliberately NOT cleared on sign-out: a theme choice belongs to the device, and a person who signs
 * out and back in should not be walked through the app again.
 */
const secureStorage: StateStorage = {
  getItem: async (name) => (await getSecureItem(name)) ?? null,
  setItem: async (name, value) => setSecureItem(name, value),
  removeItem: async (name) => deleteSecureItem(name),
};

export type ThemeMode = "system" | "light" | "dark";

interface PrefsState {
  themeMode: ThemeMode;
  /** The first-run walkthrough has been finished or skipped. */
  walkthroughSeen: boolean;
  /** How many times the app has been opened while signed in -- decides when to ask for a rating. */
  launchCount: number;
  /** The rating prompt has been shown once; it is never shown again automatically. */
  reviewPrompted: boolean;
  hasHydrated: boolean;

  setThemeMode: (mode: ThemeMode) => void;
  setWalkthroughSeen: (seen: boolean) => void;
  incrementLaunchCount: () => void;
  setReviewPrompted: () => void;
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      themeMode: "system",
      walkthroughSeen: false,
      launchCount: 0,
      reviewPrompted: false,
      hasHydrated: false,

      setThemeMode: (themeMode) => set({ themeMode }),
      setWalkthroughSeen: (walkthroughSeen) => set({ walkthroughSeen }),
      incrementLaunchCount: () => set((s) => ({ launchCount: s.launchCount + 1 })),
      setReviewPrompted: () => set({ reviewPrompted: true }),
    }),
    {
      name: "vrodux.prefs",
      storage: createJSONStorage(() => secureStorage),
      partialize: (s) => ({
        themeMode: s.themeMode,
        walkthroughSeen: s.walkthroughSeen,
        launchCount: s.launchCount,
        reviewPrompted: s.reviewPrompted,
      }),
      onRehydrateStorage: () => () => {
        usePrefsStore.setState({ hasHydrated: true });
      },
    },
  ),
);
