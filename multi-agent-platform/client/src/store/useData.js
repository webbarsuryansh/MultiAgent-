import { create } from 'zustand';
import { api } from '../services/api';

/** Small shared cache for agents and models used by several screens. */
export const useData = create((set) => ({
  agents: [],
  models: [],
  loadAgents: async () => { const { data } = await api.get('/agents'); set({ agents: data.agents }); return data.agents; },
  loadModels: async () => { const { data } = await api.get('/models'); set({ models: data.models }); return data.models; },
}));
