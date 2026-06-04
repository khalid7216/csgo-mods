import { create } from 'zustand';

export const useAppStore = create((set, get) => ({
  config: null,
  toasts: [],
  setConfig: (config) => set({ config }),
  patchConfig: (patch) => set((state) => ({
    config: {
      ...(state.config || {}),
      ...patch
    }
  })),
  addToast: (message, type = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }]
    }));
    window.setTimeout(() => get().removeToast(id), 3000);
  },
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter((toast) => toast.id !== id)
  }))
}));
