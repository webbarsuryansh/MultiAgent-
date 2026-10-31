import { randomUUID } from 'crypto';
import { z } from 'zod';
import User from '../models/User.js';
import { userFromToken } from '../middleware/authMiddleware.js';
import { handleChat, regenerateSlot } from '../services/chatService.js';
import { chatSchema } from '../controllers/chatController.js';

const sendSchema = chatSchema.extend({ requestId: z.string().min(1).max(80).default(() => randomUUID()) });
const regenSchema = z.object({ requestId: z.string().min(1).max(80), messageId: z.string().regex(/^[a-f\d]{24}$/i), key: z.string().max(100) });

const WINDOW = 60_000;
const MAX_PER_WINDOW = 20;
const MAX_ACTIVE_PER_SOCKET = 3;
const recent = new Map(); // userId -> timestamps

function allow(userId) {
  const now = Date.now();
  const list = (recent.get(userId) || []).filter((t) => now - t < WINDOW);
  if (list.length >= MAX_PER_WINDOW) { recent.set(userId, list); return false; }
  list.push(now);
  recent.set(userId, list);
  return true;
}

export default function registerSocket(io) {
  io.use(async (socket, next) => {
    try { socket.data.userId = String((await userFromToken(socket.handshake.auth?.token))._id); next(); } catch (e) { next(new Error(e.message)); }
  });

  io.on('connection', (socket) => {
    const runs = new Map(); // requestId -> AbortController

    const start = async (requestId, work) => {
      if (runs.size >= MAX_ACTIVE_PER_SOCKET) return socket.emit('chat:error', { requestId, error: 'Too many prompts running at once. Wait for one to finish or stop it.' });
      if (!allow(socket.data.userId)) return socket.emit('chat:error', { requestId, error: 'You are sending prompts too quickly. Try again in a minute.' });
      const ac = new AbortController();
      runs.set(requestId, ac);
      const emit = (event, data) => socket.emit(event, { requestId, ...data });
      try {
        const user = await User.findById(socket.data.userId); // fresh preferences every run
        if (!user) throw new Error('Account no longer exists');
        await work({ user, emit, signal: ac.signal });
      } catch (err) {
        emit('chat:error', { error: err.status && err.status < 500 ? err.message : 'Something went wrong while running your prompt.' });
        if (!err.status || err.status >= 500) console.error('[socket]', err);
      } finally {
        runs.delete(requestId);
      }
    };

    socket.on('chat:send', (raw) => {
      const parsed = sendSchema.safeParse(raw);
      if (!parsed.success) return socket.emit('chat:error', { requestId: raw?.requestId, error: parsed.error.issues[0]?.message || 'Invalid request' });
      const { requestId, ...payload } = parsed.data;
      start(requestId, ({ user, emit, signal }) => handleChat({ user, payload, emit, signal }));
    });

    socket.on('agent:regenerate', (raw) => {
      const parsed = regenSchema.safeParse(raw);
      if (!parsed.success) return;
      const { requestId, messageId, key } = parsed.data;
      start(requestId, ({ user, emit, signal }) => regenerateSlot({ user, messageId, key, emit, signal }));
    });

    socket.on('chat:cancel', ({ requestId } = {}) => runs.get(requestId)?.abort());
    socket.on('disconnect', () => runs.forEach((ac) => ac.abort()));
  });
}
