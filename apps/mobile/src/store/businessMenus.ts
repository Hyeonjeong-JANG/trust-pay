import { create } from 'zustand';

export interface BusinessMenuItem {
  id: string;
  name: string;
  amount: number;
}

interface BusinessMenuState {
  menusByBusinessId: Record<string, BusinessMenuItem[]>;
  addMenu: (businessId: string, name: string, amount: number) => void;
}

let nextMenuId = 1;

export const useBusinessMenuStore = create<BusinessMenuState>()((set) => ({
  menusByBusinessId: {},
  addMenu: (businessId, name, amount) => {
    const menu = { id: `local-menu-${nextMenuId++}`, name, amount };
    set((state) => ({
      menusByBusinessId: {
        ...state.menusByBusinessId,
        [businessId]: [...(state.menusByBusinessId[businessId] ?? []), menu],
      },
    }));
  },
}));
