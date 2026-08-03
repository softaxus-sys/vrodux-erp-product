import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/** The restaurant "acting branch" a user has switched to — null means "All Branches"
 * (the default, and the only option for a user with no UserBranch assignments). */
interface BranchState {
  currentBranchId: string | null;
  setCurrentBranchId: (id: string | null) => void;
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set) => ({
      currentBranchId: null,
      setCurrentBranchId: (id) => set({ currentBranchId: id }),
    }),
    {
      name: "restaurant-branch-storage",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
