import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NotificationPreferences {
  morningReminder: boolean;
  afternoonCheck: boolean;
  eveningReminder: boolean;
  progressNotification: boolean;
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
        progressNotification: false,
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
      version: 1,
      migrate: (persisted: any, version: number) => {
        if (version === 0 || !version) {
          const state = persisted as { preferences?: any; initialized?: boolean };
          const prefs = state.preferences || {};
          return {
            ...state,
            preferences: {
              morningReminder: prefs.morningReminder ?? true,
              afternoonCheck: prefs.afternoonCheck ?? true,
              eveningReminder: prefs.eveningReminder ?? true,
              progressNotification: prefs.progressNotification ?? false,
            },
            initialized: state.initialized ?? false,
          };
        }
        return persisted as NotificationStore;
      },
    }
  )
);
