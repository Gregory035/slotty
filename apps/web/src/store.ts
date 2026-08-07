import { create } from 'zustand';
import { readSession, writeSession } from './api';
import type { Section, Session } from './types';

const companyKey = 'telegram-business-company';

interface AppState {
  session: Session | null;
  activeCompanyId: string | null;
  section: Section;
  sidebarOpen: boolean;
  setSession: (session: Session | null) => void;
  setActiveCompanyId: (companyId: string | null) => void;
  setSection: (section: Section) => void;
  toggleSidebar: () => void;
  closeSidebar: () => void;
}

function initialCompany(): string | null {
  return typeof localStorage === 'undefined'
    ? null
    : localStorage.getItem(companyKey);
}

export const useAppStore = create<AppState>((set) => ({
  session: readSession(),
  activeCompanyId: initialCompany(),
  section: 'overview',
  sidebarOpen: false,
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
  setSection: (section) => set({ section, sidebarOpen: false }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),
}));
