import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type UserRole = 'consumer' | 'business';

interface AuthState {
  role: UserRole | null;
  userId: string | null;
  name: string | null;
  token: string | null;
  _hasHydrated: boolean;
  setAuth: (role: UserRole, userId: string, name: string, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      role: null,
      userId: null,
      name: null,
      token: null,
      _hasHydrated: false,
      setAuth: (role, userId, name, token) => set({ role, userId, name, token }),
      clearAuth: () => set({ role: null, userId: null, name: null, token: null }),
    }),
    {
      name: 'trust-pay-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        role: state.role,
        userId: state.userId,
        name: state.name,
        token: state.token,
      }),
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ _hasHydrated: true });
      },
    },
  ),
);
