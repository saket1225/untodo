import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NotificationPreferences {
  morningReminder: boolean;
  afternoonCheck: boolean;
  eveningReminder: boolean;
}

interface NotificationStore {
  preferences: NotificationPreferences;
  initialized: boolean;
  updatePreference: (key: keyof NotificationPreferences, value: boolean) => void;
  setInitialized: () => void;
}

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set) => ({
      preferences: {
        morningReminder: true,
        afternoonCheck: true,
        eveningReminder: true,
      },
      initialized: false,
      updatePreference: (key, value) =>
        set((s) => ({
          preferences: { ...s.preferences, [key]: value },
        })),
      setInitialized: () => set({ initialized: true }),
    }),
    {
      name: 'untodo-notifications',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
