import { io } from 'socket.io-client';

let socket = null;
export const getSocket = () => socket;

export function connectSocket(token, onEvent, onStatus) {
  disconnectSocket();
  socket = io(import.meta.env.VITE_SOCKET_URL || undefined, { auth: { token }, transports: ['websocket', 'polling'] });
  ['chat:start', 'round:start', 'round:early-stop', 'agent:status', 'agent:token', 'agent:reset', 'agent:done', 'agent:error',
    'eval:start', 'eval:done', 'eval:error', 'synth:start', 'synth:token', 'synth:reset', 'synth:done', 'synth:error', 'chat:done', 'chat:error']
    .forEach((ev) => socket.on(ev, (data) => onEvent(ev, data || {})));
  socket.on('connect', () => onStatus?.('connected'));
  socket.on('disconnect', () => onStatus?.('disconnected'));
  socket.on('connect_error', (e) => onStatus?.('error', e.message));
  return socket;
}

export function disconnectSocket() { socket?.removeAllListeners(); socket?.disconnect(); socket = null; }
