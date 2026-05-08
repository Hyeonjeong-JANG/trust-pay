import { create } from 'zustand';

type UserRole = 'consumer' | 'business';

interface AuthState {
  role: UserRole | null;
  userId: string | null;
  name: string | null;
  token: string | null;
  setAuth: (role: UserRole, userId: string, name: string, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  role: null,
  userId: null,
  name: null,
  token: null,
  setAuth: (role, userId, name, token) => set({ role, userId, name, token }),
  clearAuth: () => set({ role: null, userId: null, name: null, token: null }),
}));
