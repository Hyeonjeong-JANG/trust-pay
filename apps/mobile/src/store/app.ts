import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppState {
  hasSeenOnboarding: boolean;
  notificationsLastViewed: number;
  realtimeNotificationSeenIds: string[];
  _hasHydrated: boolean;
  setHasSeenOnboarding: (val: boolean) => void;
  setNotificationsLastViewed: (ts: number) => void;
  markRealtimeNotificationSeen: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      hasSeenOnboarding: false,
      notificationsLastViewed: 0,
      realtimeNotificationSeenIds: [],
      _hasHydrated: false,
      setHasSeenOnboarding: (val) => set({ hasSeenOnboarding: val }),
      setNotificationsLastViewed: (ts) => set({ notificationsLastViewed: ts }),
      markRealtimeNotificationSeen: (id) => set((state) => {
        if (state.realtimeNotificationSeenIds.includes(id)) return state;
        return { realtimeNotificationSeenIds: [...state.realtimeNotificationSeenIds.slice(-99), id] };
      }),
    }),
    {
      name: 'trust-pay-app',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        hasSeenOnboarding: state.hasSeenOnboarding,
        notificationsLastViewed: state.notificationsLastViewed,
        realtimeNotificationSeenIds: state.realtimeNotificationSeenIds,
      }),
      onRehydrateStorage: () => () => {
        useAppStore.setState({ _hasHydrated: true });
      },
    },
  ),
);
