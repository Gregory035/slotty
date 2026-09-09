import { create } from 'zustand';
import { readSession, writeSession } from './api';
import type { Session } from './types';

const companyKey = 'telegram-business-company';
const sidebarCollapsedKey = 'telegram-business-sidebar-collapsed';
const themeKey = 'slotty-theme';

export type ThemeMode = 'light' | 'dark' | 'system';

interface AppState {
  session: Session | null;
  activeCompanyId: string | null;
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  themeMode: ThemeMode;
  setSession: (session: Session | null) => void;
  setActiveCompanyId: (companyId: string | null) => void;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebarCollapsed: () => void;
  setThemeMode: (theme: ThemeMode) => void;
}

function initialCompany(): string | null {
  return typeof localStorage === 'undefined'
    ? null
    : localStorage.getItem(companyKey);
}

function initialSidebarCollapsed(): boolean {
  return typeof localStorage !== 'undefined'
    ? localStorage.getItem(sidebarCollapsedKey) === 'true'
    : false;
}

function initialTheme(): ThemeMode {
  if (typeof localStorage === 'undefined') return 'system';
  const value = localStorage.getItem(themeKey);
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

export const useAppStore = create<AppState>((set) => ({
  session: readSession(),
  activeCompanyId: initialCompany(),
  sidebarOpen: false,
  sidebarCollapsed: initialSidebarCollapsed(),
  themeMode: initialTheme(),
  setSession: (session) => {
    writeSession(session);
    set({ session });
  },
  setActiveCompanyId: (companyId) => {
    if (typeof localStorage !== 'undefined') {
      if (companyId) localStorage.setItem(companyKey, companyId);
      else localStorage.removeItem(companyKey);
    }
    set({ activeCompanyId: companyId });
  },
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),
  toggleSidebarCollapsed: () =>
    set((state) => {
      const sidebarCollapsed = !state.sidebarCollapsed;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(sidebarCollapsedKey, String(sidebarCollapsed));
      }
      return { sidebarCollapsed };
    }),
  setThemeMode: (themeMode) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(themeKey, themeMode);
    applyTheme(themeMode);
    set({ themeMode });
  },
}));
