import { create } from 'zustand';

let n = 0;
export const useToast = create((set, get) => ({
  items: [],
  push: (message, type = 'info') => {
    const id = ++n;
    set({ items: [...get().items, { id, message, type }] });
    setTimeout(() => get().dismiss(id), type === 'error' ? 6000 : 3200);
  },
  dismiss: (id) => set({ items: get().items.filter((t) => t.id !== id) }),
}));
export const toast = {
  success: (m) => useToast.getState().push(m, 'success'),
  error: (m) => useToast.getState().push(m, 'error'),
  info: (m) => useToast.getState().push(m, 'info'),
};
