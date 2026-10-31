import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, BookmarkCheck, Trash2, Download, Search, MessageSquare } from 'lucide-react';
import { PageShell, Spinner, Empty } from '../components/ui';
import { api, errMsg, download } from '../services/api';
import { useChat } from '../store/useChat';
import { when } from '../utils/format';
import { toast } from '../store/useToast';

export default function HistoryPage({ savedOnly = false }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(null);
  const nav = useNavigate();
  const { toggleSaved, removeConversation, loadHistory } = useChat();

  const load = () => api.get('/chat/history', { params: { search: q || undefined, saved: savedOnly || undefined } }).then((r) => setRows(r.data.conversations)).catch((e) => { toast.error(errMsg(e)); setRows([]); });
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [q, savedOnly]); // eslint-disable-line

  const save = async (c) => { await toggleSaved(c); load(); };
  const del = async (c) => { if (confirm(`Delete "${c.title}"?`) && (await removeConversation(c._id))) { load(); loadHistory(); } };

  return (
    <PageShell title={savedOnly ? 'Saved conversations' : 'All conversations'} subtitle={savedOnly ? 'Conversations you bookmarked.' : undefined}>
      <div className="relative mb-5"><Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" /><label htmlFor="hs" className="sr-only">Search conversations</label><input id="hs" className="field !pl-10" placeholder="Search by title" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {!rows ? <div className="flex justify-center py-20 text-zinc-400"><Spinner size={22} /></div> : rows.length === 0 ? (
        <Empty icon={savedOnly ? Bookmark : MessageSquare} title={q ? 'No matches' : savedOnly ? 'Nothing saved yet' : 'No conversations yet'}>{q ? 'Try a different search.' : savedOnly ? 'Use the bookmark icon on any conversation to keep it here.' : 'Start a chat and it will show up here.'}</Empty>
      ) : (
        <ul className="space-y-2">
          {rows.map((c) => (
            <li key={c._id} className="panel flex items-center gap-2 pr-2 transition hover:border-zinc-600">
              <button onClick={() => nav(`/c/${c._id}`)} className="min-w-0 flex-1 px-4 py-3 text-left"><p className="truncate text-sm font-semibold text-zinc-100">{c.title}</p><p className="mt-0.5 text-xs text-zinc-500">{when(c.updatedAt)}{c.selectedAgents?.length ? ` · ${c.selectedAgents.length} agent${c.selectedAgents.length > 1 ? 's' : ''}` : ''}</p></button>
              <button className="icon-btn" onClick={() => save(c)} aria-label={c.saved ? 'Remove bookmark' : 'Save conversation'} aria-pressed={c.saved}>{c.saved ? <BookmarkCheck size={16} className="text-violet-soft" /> : <Bookmark size={16} />}</button>
              <button className="icon-btn" onClick={() => download(`/chat/${c._id}/export?format=md`, `${c.title.slice(0, 40)}.md`).catch(() => toast.error('Export failed'))} aria-label="Export as Markdown"><Download size={16} /></button>
              <button className="icon-btn hover:!text-red-400" onClick={() => del(c)} aria-label="Delete conversation"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
