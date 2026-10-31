import { NavLink, useNavigate } from 'react-router-dom';
import { Plus, Compass, Cpu, Bookmark, KeyRound, BarChart3, MessageSquare, Trash2, X, ChevronsUpDown } from 'lucide-react';
import { useChat } from '../store/useChat';
import { useAuth } from '../store/useAuth';

const NAV = [
  { to: '/agents', icon: Compass, label: 'Explore agents' },
  { to: '/models', icon: Cpu, label: 'Model selection' },
  { to: '/saved', icon: Bookmark, label: 'Saved conversations' },
  { to: '/keys', icon: KeyRound, label: 'API settings' },
  { to: '/usage', icon: BarChart3, label: 'Usage dashboard' },
];

export const Logo = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="9" fill="#18181B" stroke="#27272A" />
    <circle cx="11" cy="12" r="4" fill="#8B5CF6" /><circle cx="21" cy="12" r="4" fill="#06B6D4" /><circle cx="16" cy="22" r="4" fill="#A78BFA" />
    <path d="M11 12h10M11 12l5 10M21 12l-5 10" stroke="#09090B" strokeWidth="1.2" opacity=".6" />
  </svg>
);

export default function Sidebar({ onNavigate }) {
  const nav = useNavigate();
  const { conversations, activeId, newChat, removeConversation } = useChat();
  const user = useAuth((s) => s.user);
  const go = (path) => { nav(path); onNavigate?.(); };

  return (
    <div className="flex h-full w-full flex-col bg-[#0c0c0f]">
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <Logo />
        <span className="font-display text-[15px] font-semibold text-white">Agent Workspace</span>
        <button className="icon-btn ml-auto md:hidden" onClick={onNavigate} aria-label="Close menu"><X size={18} /></button>
      </div>
      <div className="px-3">
        <button className="btn-primary w-full" onClick={() => { newChat(); go('/'); }}><Plus size={16} />New chat</button>
      </div>
      <nav className="mt-3 space-y-0.5 px-3" aria-label="Main">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} onClick={onNavigate} className={({ isActive }) => `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${isActive ? 'bg-violet/15 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>
            <n.icon size={16} />{n.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-4 flex items-center justify-between px-6"><h2 className="text-xs font-semibold text-zinc-500">Chat history</h2></div>
      <div className="mt-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-2">
        {conversations.length === 0 && <p className="px-3 py-2 text-sm text-zinc-500">Your conversations will show up here.</p>}
        {conversations.map((c) => (
          <div key={c._id} className={`group flex items-center rounded-xl pr-1 transition ${activeId === c._id ? 'bg-white/[.07]' : 'hover:bg-white/5'}`}>
            <button onClick={() => go(`/c/${c._id}`)} className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left text-sm text-zinc-300" title={c.title}>
              <MessageSquare size={14} className="shrink-0 text-zinc-500" /><span className="truncate">{c.title}</span>
            </button>
            <button className="icon-btn !h-7 !w-7 opacity-0 focus:opacity-100 group-hover:opacity-100" aria-label={`Delete ${c.title}`}
              onClick={async () => { if (confirm('Delete this conversation?')) { const ok = await removeConversation(c._id); if (ok && activeId === c._id) go('/'); } }}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <button onClick={() => go('/profile')} className="m-3 flex items-center gap-3 rounded-xl border border-line bg-card p-2.5 text-left transition hover:border-zinc-600">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet to-cyan font-display text-sm font-semibold text-white">{user?.username?.[0]?.toUpperCase()}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-white">{user?.username}</span><span className="block text-xs capitalize text-zinc-500">{user?.subscriptionPlan} plan{user?.role === 'admin' ? ' · admin' : ''}</span></span>
        <ChevronsUpDown size={14} className="text-zinc-500" />
      </button>
    </div>
  );
}
