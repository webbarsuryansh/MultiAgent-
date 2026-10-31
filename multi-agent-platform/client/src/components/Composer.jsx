import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Square, Paperclip, Mic, MicOff, X, Wand2, SlidersHorizontal, FileText, Image as ImageIcon, Route, Users, Swords, Check } from 'lucide-react';
import { useChat } from '../store/useChat';
import { useData } from '../store/useData';
import { agentIcon } from '../utils/icons';
import { Spinner } from './ui';
import { toast } from '../store/useToast';

const MODES = [
  { id: 'parallel', label: 'Parallel', icon: Route, hint: 'Each agent answers on its own, then the critic scores and the synthesizer merges.' },
  { id: 'collab', label: 'Collaborate', icon: Users, hint: 'Agents read each other and refine their answers over a few rounds.' },
  { id: 'arena', label: 'Model arena', icon: Swords, hint: 'One agent answers with several different models so you can compare them.' },
];

const SpeechRec = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export default function Composer({ busy, onSubmit, onStop, large = false }) {
  const [text, setText] = useState('');
  const [picker, setPicker] = useState(false);
  const [listening, setListening] = useState(false);
  const [uploading, setUploading] = useState(0);
  const { mode, setMode, autoSelect, setAutoSelect, manualAgents, toggleManualAgent, attachments, uploadFile, removeAttachment } = useChat();
  const agents = useData((s) => s.agents).filter((a) => a.role === 'worker' && a.enabled);
  const ta = useRef(null);
  const file = useRef(null);
  const rec = useRef(null);

  useEffect(() => { const el = ta.current; if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 220)}px`; } }, [text]);
  useEffect(() => () => rec.current?.stop(), []);

  const submit = () => { const v = text.trim(); if (!v || busy) return; if (onSubmit(v) !== false) setText(''); };
  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } };

  const pickFiles = async (e) => {
    const files = [...e.target.files]; e.target.value = '';
    for (const f of files.slice(0, 4 - attachments.length)) { setUploading((n) => n + 1); await uploadFile(f); setUploading((n) => n - 1); }
  };

  const toggleVoice = () => {
    if (!SpeechRec) return toast.error('Voice input is not supported in this browser. Try Chrome or Edge.');
    if (listening) { rec.current?.stop(); return; }
    const r = new SpeechRec(); r.interimResults = false; r.continuous = true; r.lang = navigator.language || 'en-US';
    r.onresult = (ev) => { const t = [...ev.results].slice(ev.resultIndex).map((x) => x[0].transcript).join(' '); setText((p) => `${p}${p && !p.endsWith(' ') ? ' ' : ''}${t.trim()}`); };
    r.onerror = (ev) => { setListening(false); if (ev.error === 'not-allowed') toast.error('Microphone access was blocked. Allow it in your browser settings.'); };
    r.onend = () => setListening(false);
    rec.current = r; r.start(); setListening(true);
  };

  const modeInfo = MODES.find((m) => m.id === mode);
  const chosen = agents.filter((a) => manualAgents.includes(a.key));

  return (
    <div className="w-full">
      <div className={`panel relative p-2.5 transition focus-within:border-violet/60 focus-within:shadow-neon ${large ? 'rounded-3xl' : ''}`}>
        {(attachments.length > 0 || uploading > 0) && (
          <div className="flex flex-wrap gap-1.5 px-1.5 pb-2">
            {attachments.map((a) => <span key={a.id} className="chip !text-zinc-200">{a.kind === 'image' ? <ImageIcon size={12} /> : <FileText size={12} />}{a.name}<button onClick={() => removeAttachment(a.id)} aria-label={`Remove ${a.name}`} className="ml-0.5 text-zinc-500 hover:text-white"><X size={12} /></button></span>)}
            {uploading > 0 && <span className="chip"><Spinner size={11} />Reading file…</span>}
          </div>
        )}
        <label htmlFor="prompt" className="sr-only">Prompt</label>
        <textarea id="prompt" ref={ta} rows={large ? 3 : 1} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} maxLength={20000}
          placeholder="Ask anything. The router will pick the right agents."
          className="block max-h-56 w-full resize-none bg-transparent px-2 py-1.5 text-[15px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none" />
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <input ref={file} type="file" className="hidden" multiple accept=".pdf,.docx,.txt,.md,image/png,image/jpeg,image/webp,image/gif" onChange={pickFiles} />
          <button className="icon-btn" onClick={() => file.current?.click()} disabled={attachments.length >= 4} aria-label="Attach file (PDF, DOCX, TXT or image)" title="Attach PDF, DOCX, TXT or image"><Paperclip size={17} /></button>
          <button className={`icon-btn ${listening ? '!text-red-400' : ''}`} onClick={toggleVoice} aria-label={listening ? 'Stop voice input' : 'Start voice input'} aria-pressed={listening}>{listening ? <MicOff size={17} /> : <Mic size={17} />}</button>

          <div className="ml-1 flex rounded-xl border border-line p-0.5" role="radiogroup" aria-label="Response mode">
            {MODES.map((m) => (
              <button key={m.id} role="radio" aria-checked={mode === m.id} title={m.hint} onClick={() => setMode(m.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${mode === m.id ? 'bg-violet/20 text-violet-soft' : 'text-zinc-400 hover:text-white'}`}>
                <m.icon size={13} /><span className="hidden sm:inline">{m.label}</span>
              </button>
            ))}
          </div>

          <div className="relative">
            <button className={`btn-ghost !px-2.5 !py-1.5 text-xs ${!autoSelect ? '!text-cyan-soft' : ''}`} onClick={() => setPicker((v) => !v)} aria-expanded={picker} aria-haspopup="dialog">
              {autoSelect ? <Wand2 size={14} /> : <SlidersHorizontal size={14} />}{autoSelect ? 'Auto agents' : `${chosen.length || 0} agent${chosen.length === 1 ? '' : 's'}`}
            </button>
            {picker && (
              <div role="dialog" aria-label="Choose agents" className="absolute bottom-11 left-0 z-30 w-72 rounded-2xl border border-line bg-raised p-2 shadow-2xl sm:w-80">
                <button onClick={() => setAutoSelect(true)} className={`mb-1 flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left hover:bg-white/5 ${autoSelect ? 'bg-violet/10' : ''}`}>
                  <Wand2 size={16} className="mt-0.5 text-violet-soft" /><span className="flex-1"><span className="block text-sm font-semibold text-white">Automatic</span><span className="block text-xs text-zinc-400">The router picks agents for each prompt.</span></span>{autoSelect && <Check size={15} className="text-violet-soft" />}
                </button>
                <p className="px-2.5 pb-1 pt-2 text-xs font-semibold text-zinc-500">Or choose yourself{mode === 'arena' ? ' (first one is used)' : ''}</p>
                <div className="max-h-64 overflow-y-auto">
                  {agents.map((a) => { const I = agentIcon(a.icon); const on = !autoSelect && manualAgents.includes(a.key); return (
                    <button key={a.key} onClick={() => { if (autoSelect) setAutoSelect(false); toggleManualAgent(a.key); }} className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left hover:bg-white/5 ${on ? 'bg-cyan/10' : ''}`} role="checkbox" aria-checked={on}>
                      <I size={15} className={on ? 'text-cyan-soft' : 'text-zinc-500'} /><span className="flex-1 truncate text-sm text-zinc-200">{a.name}</span>{on && <Check size={14} className="text-cyan-soft" />}
                    </button>); })}
                </div>
                <div className="flex justify-end pt-2"><button className="btn-ghost !py-1 text-xs" onClick={() => setPicker(false)}>Done</button></div>
              </div>
            )}
          </div>

          <div className="ml-auto">
            {busy ? (
              <button className="btn-outline !rounded-full !p-2.5" onClick={onStop} aria-label="Stop generating"><Square size={15} fill="currentColor" /></button>
            ) : (
              <button className="btn-primary !rounded-full !p-2.5" onClick={submit} disabled={!text.trim()} aria-label="Send prompt"><ArrowUp size={17} /></button>
            )}
          </div>
        </div>
      </div>
      <p className="mt-2 px-2 text-center text-xs text-zinc-500">{modeInfo.hint} Enter to send, Shift+Enter for a new line.</p>
    </div>
  );
}
