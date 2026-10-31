import { create } from 'zustand';
import { api } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

export const useAuth = create((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  ready: false,
  socketStatus: 'disconnected',

  init: async () => {
    const { token } = get();
    if (!token) return set({ ready: true });
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.user, ready: true });
    } catch {
      localStorage.removeItem('token');
      set({ token: null, user: null, ready: true });
    }
  },

  authenticate: async (mode, body) => {
    const { data } = await api.post(`/auth/${mode}`, body);
    localStorage.setItem('token', data.token);
    set({ token: data.token, user: data.user });
  },

  setUser: (user) => set({ user }),

  logout: () => {
    localStorage.removeItem('token');
    disconnectSocket();
    set({ token: null, user: null, socketStatus: 'disconnected' });
  },

  connect: (onEvent) => {
    const { token } = get();
    if (token) connectSocket(token, onEvent, (s) => set({ socketStatus: s }));
  },
}));
