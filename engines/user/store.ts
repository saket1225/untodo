import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UserStore {
  username: string | null;
  setUsername: (name: string) => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      username: null,
      setUsername: (name: string) => set({ username: name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9_]/g, '') }),
    }),
    {
      name: 'untodo-user',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
