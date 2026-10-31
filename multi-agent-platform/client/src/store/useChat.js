import { create } from 'zustand';
import { api, errMsg } from '../services/api';
import { getSocket } from '../services/socket';
import { toast } from './useToast';
import { providerLabel } from '../utils/format';

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

/** Convert a persisted Message document into the same shape live turns use. */
export function fromMessage(m) {
  const agents = {};
  for (const r of m.agentResponses || []) agents[r.key] = { ...r, providerLabel: providerLabel(r.provider) };
  const f = m.finalResponse;
  return {
    id: String(m._id), messageId: String(m._id), prompt: m.prompt, createdAt: m.createdAt, mode: m.mode, routing: m.routing,
    status: m.status === 'done' ? 'done' : m.status === 'running' ? 'cancelled' : m.status, // a "running" row in the DB means the run was interrupted
    agents, order: (m.agentResponses || []).map((r) => r.key), attachments: m.attachments || [],
    final: f?.status ? { status: f.status, content: f.content || '', model: f.model, provider: f.provider, error: f.error } : null,
    evalState: m.agentResponses?.some((r) => r.evaluation) ? 'done' : 'idle', evalSummary: m.evaluationSummary || '',
    votes: m.votes || {}, round: null, totalRounds: 1, error: null,
  };
}

const newTurn = (id, prompt, mode) => ({
  id, messageId: null, prompt, mode, createdAt: new Date().toISOString(), status: 'running', routing: null,
  agents: {}, order: [], attachments: [], final: null, evalState: 'idle', evalSummary: '', votes: {}, round: null, totalRounds: 1, error: null,
});

// Token events arrive very fast; batch them into one state update per animation frame.
const pending = { agent: {}, synth: {} };
let flushScheduled = false;

export const useChat = create((set, get) => {
  const patchTurn = (id, fn) => set((s) => ({ turns: s.turns.map((t) => (t.id === id ? fn(t) : t)) }));

  const flush = () => {
    flushScheduled = false;
    const a = pending.agent; const sy = pending.synth;
    pending.agent = {}; pending.synth = {};
    set((s) => ({
      turns: s.turns.map((t) => {
        const ag = a[t.id]; const syn = sy[t.id];
        if (!ag && syn == null) return t;
        let next = t;
        if (ag) {
          const agents = { ...t.agents };
          for (const [k, text] of Object.entries(ag)) if (agents[k]) agents[k] = { ...agents[k], status: 'running', content: (agents[k].content || '') + text };
          next = { ...next, agents };
        }
        if (syn != null) next = { ...next, final: { ...(next.final || {}), status: 'running', content: (next.final?.content || '') + syn } };
        return next;
      }),
    }));
  };
  const schedule = () => { if (!flushScheduled) { flushScheduled = true; requestAnimationFrame(flush); } };

  return {
    conversations: [], activeId: null, turns: [], loadingConvo: false,
    mode: 'parallel', autoSelect: true, manualAgents: [], attachments: [],

    setMode: (mode) => set({ mode }),
    setAutoSelect: (autoSelect) => set({ autoSelect }),
    setManualAgents: (manualAgents) => set({ manualAgents, autoSelect: false }),
    toggleManualAgent: (key) => set((s) => ({ manualAgents: s.manualAgents.includes(key) ? s.manualAgents.filter((k) => k !== key) : [...s.manualAgents, key].slice(0, 6) })),

    loadHistory: async () => {
      try { const { data } = await api.get('/chat/history'); set({ conversations: data.conversations }); } catch (e) { toast.error(errMsg(e)); }
    },
    newChat: () => set({ activeId: null, turns: [], attachments: [] }),
    openConversation: async (id) => {
      set({ loadingConvo: true });
      try {
        const { data } = await api.get(`/chat/${id}`);
        set({ activeId: id, turns: data.messages.map(fromMessage), loadingConvo: false });
      } catch (e) { set({ loadingConvo: false, activeId: null, turns: [] }); toast.error(errMsg(e)); }
    },
    removeConversation: async (id) => {
      try {
        await api.delete(`/chat/${id}`);
        set((s) => ({ conversations: s.conversations.filter((c) => c._id !== id), ...(s.activeId === id ? { activeId: null, turns: [] } : {}) }));
        toast.success('Conversation deleted');
        return true;
      } catch (e) { toast.error(errMsg(e)); return false; }
    },
    toggleSaved: async (c) => {
      try {
        await api.patch(`/chat/${c._id}`, { saved: !c.saved });
        set((s) => ({ conversations: s.conversations.map((x) => (x._id === c._id ? { ...x, saved: !c.saved } : x)) }));
      } catch (e) { toast.error(errMsg(e)); }
    },

    uploadFile: async (file) => {
      const fd = new FormData(); fd.append('file', file);
      try {
        const { data } = await api.post('/uploads', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        set((s) => ({ attachments: [...s.attachments, data.upload].slice(0, 4) }));
        if (data.upload.truncated) toast.info('Large file: only the first 30,000 characters will be used.');
      } catch (e) { toast.error(errMsg(e)); }
    },
    removeAttachment: (id) => set((s) => ({ attachments: s.attachments.filter((a) => a.id !== id) })),

    isBusy: () => get().turns.some((t) => t.status === 'running'),

    send: (prompt) => {
      const socket = getSocket();
      if (!socket?.connected) { toast.error('Not connected to the server yet. Wait a moment and try again.'); return false; }
      const s = get();
      const id = uid();
      const turn = { ...newTurn(id, prompt, s.mode), attachments: s.attachments.map((a) => ({ name: a.name, mime: a.mime })) };
      set({ turns: [...s.turns, turn], attachments: [] });
      socket.emit('chat:send', {
        requestId: id, prompt, mode: s.mode, conversationId: s.activeId || undefined,
        agentKeys: !s.autoSelect && s.manualAgents.length && s.mode !== 'arena' ? s.manualAgents : (s.mode === 'arena' && !s.autoSelect && s.manualAgents[0] ? [s.manualAgents[0]] : undefined),
        attachmentIds: s.attachments.map((a) => a.id),
      });
      return true;
    },
    cancel: (id) => getSocket()?.emit('chat:cancel', { requestId: id }),

    regenerate: (turn, key) => {
      const socket = getSocket();
      if (!socket?.connected || !turn.messageId) return;
      patchTurn(turn.id, (t) => ({ ...t, agents: { ...t.agents, [key]: { ...t.agents[key], status: 'running', content: '', error: null, evaluation: undefined } } }));
      socket.emit('agent:regenerate', { requestId: turn.id, messageId: turn.messageId, key });
    },

    feedback: async (turn, key, value) => {
      const prev = turn.agents[key]?.feedback || null;
      const next = prev === value ? null : value;
      patchTurn(turn.id, (t) => ({ ...t, agents: { ...t.agents, [key]: { ...t.agents[key], feedback: next } } }));
      try { await api.post(`/chat/message/${turn.messageId}/feedback`, { key, value: next }); } catch (e) {
        patchTurn(turn.id, (t) => ({ ...t, agents: { ...t.agents, [key]: { ...t.agents[key], feedback: prev } } }));
        toast.error(errMsg(e));
      }
    },
    vote: async (turn, kind, key) => {
      const prev = turn.votes?.[kind];
      const next = prev === key ? null : key;
      patchTurn(turn.id, (t) => ({ ...t, votes: { ...t.votes, [kind]: next || undefined } }));
      try { await api.post(`/chat/message/${turn.messageId}/vote`, { kind, key: next }); } catch (e) {
        patchTurn(turn.id, (t) => ({ ...t, votes: { ...t.votes, [kind]: prev } }));
        toast.error(errMsg(e));
      }
    },

    /** Entry point for every Socket.IO event. */
    applyEvent: (ev, d) => {
      const id = d.requestId;
      const exists = get().turns.some((t) => t.id === id);
      if (ev === 'agent:token') { (pending.agent[id] ||= {})[d.key] = ((pending.agent[id] ||= {})[d.key] || '') + d.token; return schedule(); }
      if (ev === 'synth:token') { pending.synth[id] = (pending.synth[id] || '') + d.token; return schedule(); }
      if (exists && (ev !== 'chat:start')) flush(); // keep ordering: apply buffered tokens before state-changing events

      switch (ev) {
        case 'chat:start': {
          patchTurn(id, (t) => ({
            ...t, messageId: d.messageId, routing: d.routing, mode: d.mode, order: d.agents.map((a) => a.key),
            agents: Object.fromEntries(d.agents.map((a) => [a.key, { ...a, content: '' }])),
          }));
          const isNew = get().activeId !== d.conversationId;
          set((s) => ({
            activeId: d.conversationId,
            conversations: isNew && !s.conversations.some((c) => c._id === d.conversationId)
              ? [{ _id: d.conversationId, title: d.title, updatedAt: new Date().toISOString(), saved: false }, ...s.conversations]
              : s.conversations.map((c) => (c._id === d.conversationId ? { ...c, updatedAt: new Date().toISOString() } : c)),
          }));
          break;
        }
        case 'round:start': patchTurn(id, (t) => ({ ...t, round: d.round, totalRounds: d.total })); break;
        case 'round:early-stop': patchTurn(id, (t) => ({ ...t, earlyStop: d.round })); break;
        case 'agent:status':
          patchTurn(id, (t) => ({ ...t, agents: { ...t.agents, [d.key]: { ...t.agents[d.key], status: 'running', modelName: d.modelName, provider: d.provider, providerLabel: d.providerLabel, fallback: d.fallback, round: d.round } } }));
          break;
        case 'agent:reset': patchTurn(id, (t) => ({ ...t, agents: { ...t.agents, [d.key]: { ...t.agents[d.key], content: '' } } })); break;
        case 'agent:done':
          patchTurn(id, (t) => ({ ...t, agents: { ...t.agents, [d.key]: { ...t.agents[d.key], ...d, status: 'completed', providerLabel: providerLabel(d.provider), evaluation: d.evaluation, error: null } } }));
          break;
        case 'agent:error':
          patchTurn(id, (t) => ({ ...t, agents: { ...t.agents, [d.key]: { ...t.agents[d.key], ...d, status: d.status === 'cancelled' ? 'cancelled' : 'failed' } } }));
          break;
        case 'eval:start': patchTurn(id, (t) => ({ ...t, evalState: 'running' })); break;
        case 'eval:done':
          patchTurn(id, (t) => ({
            ...t, evalState: 'done', evalSummary: d.summary, judge: d.judge,
            agents: Object.fromEntries(Object.entries(t.agents).map(([k, a]) => [k, d.evaluations[k] ? { ...a, evaluation: d.evaluations[k] } : a])),
          }));
          break;
        case 'eval:error': patchTurn(id, (t) => ({ ...t, evalState: 'error', evalError: d.error })); break;
        case 'synth:start': patchTurn(id, (t) => ({ ...t, final: { status: 'running', content: t.final?.content || '', model: d.model, provider: d.provider } })); break;
        case 'synth:reset': patchTurn(id, (t) => ({ ...t, final: { ...t.final, content: '' } })); break;
        case 'synth:done': patchTurn(id, (t) => ({ ...t, final: { status: 'completed', content: d.content, model: d.model, provider: d.provider } })); break;
        case 'synth:error': patchTurn(id, (t) => ({ ...t, final: { status: 'failed', content: '', error: d.error } })); break;
        case 'chat:done':
          patchTurn(id, (t) => ({
            ...t, status: d.status === 'cancelled' ? 'cancelled' : 'done', usage: d.usage || t.usage,
            agents: Object.fromEntries(Object.entries(t.agents).map(([k, a]) => [k, ['queued', 'running'].includes(a.status) && d.status === 'cancelled' ? { ...a, status: 'cancelled' } : a])),
            final: t.final?.status === 'running' ? { ...t.final, status: d.status === 'cancelled' ? 'cancelled' : t.final.status } : t.final,
          }));
          break;
        case 'chat:error':
          if (exists) patchTurn(id, (t) => ({ ...t, status: 'error', error: d.error }));
          else toast.error(d.error);
          break;
        default: break;
      }
    },
  };
});
