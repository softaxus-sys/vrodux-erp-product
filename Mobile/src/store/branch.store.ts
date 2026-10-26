import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { getSecureItem, setSecureItem, deleteSecureItem } from "@/lib/secure-storage";
import { queryClient } from "@/lib/query-client";
import { useAuthStore } from "@/store/auth.store";

/**
 * The branch this phone is working at. Restaurant till work always happens at one branch: the
 * server refuses an order without one (when the workspace has branches) and refuses a shift at a
 * different branch from the order. null = "no branch chosen" -- fine for a workspace with no
 * branches at all, and what a single-location restaurant runs on.
 *
 * Read synchronously by the API layer (`currentBranchId()`), so every restaurant request carries the
 * branch without each hook having to thread it through.
 */
const secureStorage: StateStorage = {
  getItem: async (name) => (await getSecureItem(name)) ?? null,
  setItem: async (name, value) => setSecureItem(name, value),
  removeItem: async (name) => deleteSecureItem(name),
};

interface BranchState {
  branchId: string | null;
  setBranchId: (id: string | null) => void;
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set, get) => ({
      branchId: null,
      setBranchId: (id) => {
        if (get().branchId === id) return;
        set({ branchId: id });
        // Everything cached belongs to the previous branch. Drop it rather than show it for a
        // moment under the new branch's name.
        queryClient.removeQueries({ queryKey: ["restaurant"] });
        queryClient.removeQueries({ queryKey: ["pos"] });
      },
    }),
    { name: "vrodux.branch", storage: createJSONStorage(() => secureStorage) },
  ),
);

/** The selected branch id, or null. Safe to call outside React. */
export const currentBranchId = (): string | null => useBranchStore.getState().branchId;

// A branch belongs to a workspace: forget it when the session ends, or the next person to sign in
// on this phone would start on someone else's branch.
useAuthStore.subscribe((s, prev) => {
  if (prev.isAuthenticated && !s.isAuthenticated) useBranchStore.setState({ branchId: null });
});
