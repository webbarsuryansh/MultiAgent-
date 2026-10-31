import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, WifiOff } from 'lucide-react';
import Sidebar, { Logo } from '../components/Sidebar';
import { useAuth } from '../store/useAuth';
import { useChat } from '../store/useChat';
import { useData } from '../store/useData';

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const { connect, socketStatus } = useAuth();
  const applyEvent = useChat((s) => s.applyEvent);
  const loadHistory = useChat((s) => s.loadHistory);
  const loadAgents = useData((s) => s.loadAgents);

  useEffect(() => { connect(applyEvent); loadHistory(); loadAgents().catch(() => {}); }, [connect, applyEvent, loadHistory, loadAgents]);

  return (
    <div className="flex h-full bg-ink">
      <aside className="hidden w-72 shrink-0 border-r border-line md:block"><Sidebar /></aside>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[82%] max-w-xs border-r border-line"><Sidebar onNavigate={() => setOpen(false)} /></aside>
        </div>
      )}
      <main className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3 md:hidden">
          <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button><Logo size={24} /><span className="font-display text-sm font-semibold text-white">Agent Workspace</span>
        </div>
        {socketStatus !== 'connected' && (
          <div role="status" className="flex items-center justify-center gap-2 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-200"><WifiOff size={13} />{socketStatus === 'error' ? 'Cannot reach the server. Retrying…' : 'Connecting to the server…'}</div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto"><Outlet /></div>
      </main>
    </div>
  );
}
