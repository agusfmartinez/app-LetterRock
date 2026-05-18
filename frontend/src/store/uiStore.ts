import { create } from 'zustand'

interface UiStore {
  searchQuery: string
  selectedFilter: string
  setSearchQuery: (q: string) => void
  setSelectedFilter: (f: string) => void
}

export const useUiStore = create<UiStore>((set) => ({
  searchQuery: '',
  selectedFilter: 'all',
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSelectedFilter: (f) => set({ selectedFilter: f }),
}))
