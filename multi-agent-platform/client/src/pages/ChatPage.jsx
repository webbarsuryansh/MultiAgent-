import { useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Code2, GraduationCap, Briefcase, Sparkles, KeyRound, Download } from 'lucide-react';
import Composer from '../components/Composer';
import TurnView from '../components/TurnView';
import { Spinner } from '../components/ui';
import { Logo } from '../components/Sidebar';
import { useChat } from '../store/useChat';
import { useAuth } from '../store/useAuth';
import { download } from '../services/api';
import { toast } from '../store/useToast';

const SUGGESTIONS = [
  { icon: Code2, title: 'Build something', text: 'Create a complete MERN authentication system with JWT and refresh tokens.', hint: 'Coding, architecture, security, database' },
  { icon: GraduationCap, title: 'Learn something', text: 'Explain how compound interest works, with a worked example.', hint: 'Education, finance, math' },
  { icon: Briefcase, title: 'Decide something', text: 'Which programming language should I learn in 2026 for a career in AI?', hint: 'Research, business, education' },
  { icon: Sparkles, title: 'Make something', text: 'Write a 60-second ad script for a local coffee roaster launching a subscription.', hint: 'Creative, business' },
];

export default function ChatPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { turns, activeId, loadingConvo, openConversation, send, cancel } = useChat();
  const user = useAuth((s) => s.user);
  const bottom = useRef(null);
  const scroller = useRef(null);
  const stick = useRef(true);

  useEffect(() => { if (id && id !== useChat.getState().activeId) openConversation(id); }, [id, openConversation]);
  useEffect(() => { if (activeId && id !== activeId) nav(`/c/${activeId}`, { replace: true }); }, [activeId, id, nav]);

  const lastLen = turns.length ? JSON.stringify(Object.values(turns.at(-1).agents).map((a) => a.content?.length)) + (turns.at(-1).final?.content?.length || 0) : '';
  useEffect(() => { if (stick.current) bottom.current?.scrollIntoView({ block: 'end' }); }, [turns.length, lastLen]);
  const onScroll = (e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 160; };

  const busy = turns.some((t) => t.status === 'running');
  const running = turns.find((t) => t.status === 'running');
  const submit = (text) => { stick.current = true; return send(text); };
  const exportChat = (fmt) => download(`/chat/${activeId}/export?format=${fmt}`, `conversation.${fmt === 'json' ? 'json' : 'md'}`).catch(() => toast.error('Export failed'));

  if (loadingConvo) return <div className="flex h-full items-center justify-center text-zinc-400"><Spinner size={20} /></div>;

  if (turns.length === 0) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-4 py-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 w-fit"><Logo size={52} /></div>
          <h1 className="font-display text-3xl font-semibold text-white sm:text-4xl">What should the agents work on{user ? `, ${user.username}` : ''}?</h1>
          <p className="mx-auto mt-3 max-w-xl text-zinc-400">Ask once. Specialist agents answer in parallel, a critic scores them, and a synthesizer writes the final answer.</p>
        </div>
        <Composer large busy={busy} onSubmit={submit} onStop={() => running && cancel(running.id)} />
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {SUGGESTIONS.map((s) => (
            <button key={s.title} onClick={() => submit(s.text)} className="panel group p-4 text-left transition hover:border-violet/50 hover:bg-raised">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white"><s.icon size={16} className="text-violet-soft" />{s.title}</div>
              <p className="text-sm text-zinc-300">{s.text}</p>
              <p className="mt-2 text-xs text-zinc-500">{s.hint}</p>
            </button>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-zinc-500">No answers yet? <Link to="/keys" className="inline-flex items-center gap-1 text-cyan-soft hover:underline"><KeyRound size={11} />Add an API key</Link> first.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl space-y-10 px-4 py-6 sm:px-8">
          {activeId && (
            <div className="flex justify-end gap-2 text-xs"><button className="btn-ghost !py-1" onClick={() => exportChat('md')}><Download size={13} />Markdown</button><button className="btn-ghost !py-1" onClick={() => exportChat('json')}><Download size={13} />JSON</button></div>
          )}
          {turns.map((t) => <TurnView key={t.id} turn={t} />)}
          <div ref={bottom} />
        </div>
      </div>
      <div className="border-t border-line bg-ink/90 px-4 pb-3 pt-3 backdrop-blur sm:px-8"><div className="mx-auto max-w-3xl"><Composer busy={busy} onSubmit={submit} onStop={() => running && cancel(running.id)} /></div></div>
    </div>
  );
}
