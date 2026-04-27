import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppState {
  hasSeenOnboarding: boolean;
  notificationsLastViewed: number;
  _hasHydrated: boolean;
  setHasSeenOnboarding: (val: boolean) => void;
  setNotificationsLastViewed: (ts: number) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      hasSeenOnboarding: false,
      notificationsLastViewed: 0,
      _hasHydrated: false,
      setHasSeenOnboarding: (val) => set({ hasSeenOnboarding: val }),
      setNotificationsLastViewed: (ts) => set({ notificationsLastViewed: ts }),
    }),
    {
      name: 'prepaid-shield-app',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        hasSeenOnboarding: state.hasSeenOnboarding,
        notificationsLastViewed: state.notificationsLastViewed,
      }),
      onRehydrateStorage: () => () => {
        useAppStore.setState({ _hasHydrated: true });
      },
    },
  ),
);
