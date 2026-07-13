import { create } from "zustand";
import { persist } from "zustand/middleware";

// Persisted (not just component state): if someone reloads the page while
// disguised -- e.g. their boss walked by -- it should stay disguised, not
// snap back to the obviously-AI dashboard.
type DisguiseStore = {
  disguised: boolean;
  setDisguised: (disguised: boolean) => void;
};

export const useDisguiseStore = create<DisguiseStore>()(
  persist(
    (set) => ({
      disguised: false,
      setDisguised: (disguised) => set({ disguised }),
    }),
    { name: "disguise-store" },
  ),
);
