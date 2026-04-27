import { create } from 'zustand';

type UserRole = 'consumer' | 'business';

interface AuthState {
  role: UserRole | null;
  userId: string | null;
  name: string | null;
  setAuth: (role: UserRole, userId: string, name: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  role: null,
  userId: null,
  name: null,
  setAuth: (role, userId, name) => set({ role, userId, name }),
  clearAuth: () => set({ role: null, userId: null, name: null }),
}));
