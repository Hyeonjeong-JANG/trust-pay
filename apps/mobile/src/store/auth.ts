import { create } from 'zustand';

type UserRole = 'consumer' | 'business';

interface AuthState {
  role: UserRole | null;
  xrplAddress: string | null;
  userId: string | null;
  setAuth: (role: UserRole, xrplAddress: string, userId: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  role: null,
  xrplAddress: null,
  userId: null,
  setAuth: (role, xrplAddress, userId) => set({ role, xrplAddress, userId }),
  clearAuth: () => set({ role: null, xrplAddress: null, userId: null }),
}));
