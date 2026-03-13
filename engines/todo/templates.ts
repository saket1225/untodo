import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Priority, Category } from './types';

export interface TemplateTask {
  title: string;
  priority: Priority;
  category: Category;
}

export interface TaskTemplate {
  id: string;
  name: string;
  tasks: TemplateTask[];
  isCustom: boolean;
}

const BUILT_IN_TEMPLATES: TaskTemplate[] = [
  {
    id: 'morning-routine',
    name: 'Morning Routine',
    isCustom: false,
    tasks: [
      { title: 'Wake up & hydrate', priority: 'high', category: 'health' },
      { title: 'Meditate (10 min)', priority: 'medium', category: 'health' },
      { title: 'Exercise', priority: 'high', category: 'health' },
      { title: 'Plan the day', priority: 'medium', category: 'work' },
    ],
  },
  {
    id: 'study-session',
    name: 'Study Session',
    isCustom: false,
    tasks: [
      { title: 'Review notes', priority: 'medium', category: 'learning' },
      { title: 'Active learning / deep reading', priority: 'high', category: 'learning' },
      { title: 'Practice problems', priority: 'high', category: 'learning' },
      { title: 'Summarize key takeaways', priority: 'low', category: 'learning' },
    ],
  },
  {
    id: 'workout',
    name: 'Workout',
    isCustom: false,
    tasks: [
      { title: 'Warm up (5 min)', priority: 'medium', category: 'health' },
      { title: 'Main workout', priority: 'high', category: 'health' },
      { title: 'Cool down', priority: 'medium', category: 'health' },
      { title: 'Stretch', priority: 'low', category: 'health' },
    ],
  },
  {
    id: 'deep-work',
    name: 'Deep Work Block',
    isCustom: false,
    tasks: [
      { title: 'Set intention & scope', priority: 'medium', category: 'work' },
      { title: 'Deep work session', priority: 'high', category: 'work' },
      { title: 'Review progress & notes', priority: 'low', category: 'work' },
    ],
  },
];

interface TemplateStore {
  customTemplates: TaskTemplate[];
  addCustomTemplate: (name: string, tasks: TemplateTask[]) => void;
  deleteTemplate: (id: string) => void;
  getAllTemplates: () => TaskTemplate[];
}

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export const useTemplateStore = create<TemplateStore>()(
  persist(
    (set, get) => ({
      customTemplates: [],

      addCustomTemplate: (name: string, tasks: TemplateTask[]) => {
        const template: TaskTemplate = {
          id: makeId(),
          name,
          tasks,
          isCustom: true,
        };
        set(state => ({
          customTemplates: [...state.customTemplates, template],
        }));
      },

      deleteTemplate: (id: string) => {
        set(state => ({
          customTemplates: state.customTemplates.filter(t => t.id !== id),
        }));
      },

      getAllTemplates: () => {
        return [...BUILT_IN_TEMPLATES, ...get().customTemplates];
      },
    }),
    {
      name: 'untodo-templates',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
