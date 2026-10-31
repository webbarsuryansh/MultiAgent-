import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, MessageSquarePlus, Lock } from 'lucide-react';
import { PageShell, Modal, Toggle, Spinner } from '../components/ui';
import { useData } from '../store/useData';
import { useChat } from '../store/useChat';
import { useAuth } from '../store/useAuth';
import { api, errMsg } from '../services/api';
import { agentIcon, ICON_CHOICES } from '../utils/icons';
import { toast } from '../store/useToast';

const CAPS = ['chat', 'code', 'math', 'reasoning', 'creative', 'vision', 'long-context'];
const blank = { name: '', description: '', icon: 'Bot', systemPrompt: '', supportedTasks: '', requiredCapabilities: ['chat'], temperature: 0.7 };

function AgentForm({ initial, onSaved, onClose }) {
  const [f, setF] = useState(initial ? { ...initial, supportedTasks: (initial.supportedTasks || []).join(', '), temperature: initial.configuration?.temperature ?? 0.7 } : blank);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    const body = { name: f.name, description: f.description, icon: f.icon, systemPrompt: f.systemPrompt, requiredCapabilities: f.requiredCapabilities, temperature: Number(f.temperature), supportedTasks: f.supportedTasks.split(',').map((s) => s.trim()).filter(Boolean) };
    try { if (initial) await api.put(`/agents/${initial._id}`, body); else await api.post('/agents', body); toast.success(initial ? 'Agent updated' : 'Agent created'); onSaved(); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="an">Name</label><input id="an" className="field" value={f.name} onChange={(e) => set('name', e.target.value)} required minLength={2} maxLength={60} /></div>
        <div><label className="label" htmlFor="ai">Icon</label><select id="ai" className="field" value={f.icon} onChange={(e) => set('icon', e.target.value)}>{ICON_CHOICES.map((i) => <option key={i}>{i}</option>)}</select></div>
      </div>
      <div><label className="label" htmlFor="ad">What it does</label><input id="ad" className="field" value={f.description} onChange={(e) => set('description', e.target.value)} maxLength={300} placeholder="Shown on the agent card and used by the router" /></div>
      <div><label className="label" htmlFor="ap">System prompt</label><textarea id="ap" className="field min-h-32 font-mono text-[13px]" value={f.systemPrompt} onChange={(e) => set('systemPrompt', e.target.value)} required minLength={10} maxLength={4000} placeholder="You are an expert in…" /></div>
      <div><label className="label" htmlFor="at">Topics the router should match</label><input id="at" className="field" value={f.supportedTasks} onChange={(e) => set('supportedTasks', e.target.value)} placeholder="e.g. kubernetes, helm, devops" /><p className="mt-1 text-xs text-zinc-500">Comma separated. If a prompt contains one of these words, this agent is considered.</p></div>
      <fieldset><legend className="label">Model capabilities needed</legend><div className="flex flex-wrap gap-2">{CAPS.map((c) => { const on = f.requiredCapabilities.includes(c); return <button type="button" key={c} aria-pressed={on} onClick={() => set('requiredCapabilities', on ? f.requiredCapabilities.filter((x) => x !== c) : [...f.requiredCapabilities, c])} className={`chip cursor-pointer ${on ? '!border-violet !text-violet-soft' : ''}`}>{c}</button>; })}</div></fieldset>
      <div><label className="label" htmlFor="atemp">Creativity (temperature): {Number(f.temperature).toFixed(1)}</label><input id="atemp" type="range" min="0" max="1.5" step="0.1" value={f.temperature} onChange={(e) => set('temperature', e.target.value)} className="w-full accent-violet" /></div>
      <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy}>{busy && <Spinner />}{initial ? 'Save changes' : 'Create agent'}</button></div>
    </form>
  );
}

export default function AgentsPage() {
  const { agents, loadAgents } = useData();
  const user = useAuth((s) => s.user);
  const { setManualAgents, newChat } = useChat();
  const nav = useNavigate();
  const [loading, setLoading] = useState(!agents.length);
  const [form, setForm] = useState(null); // null | 'new' | agent
  const refresh = () => loadAgents().finally(() => setLoading(false));
  useEffect(() => { refresh(); }, []); // eslint-disable-line

  const toggle = async (a) => { try { await api.put(`/agents/${a._id}`, { enabled: !a.enabled }); refresh(); } catch (e) { toast.error(errMsg(e)); } };
  const remove = async (a) => { if (!confirm(`Delete "${a.name}"?`)) return; try { await api.delete(`/agents/${a._id}`); toast.success('Agent deleted'); refresh(); } catch (e) { toast.error(errMsg(e)); } };
  const use = (a) => { newChat(); setManualAgents([a.key]); nav('/'); };

  const worker = agents.filter((a) => a.role === 'worker');
  const system = agents.filter((a) => a.role === 'system');
  const card = (a) => {
    const I = agentIcon(a.icon); const mine = String(a.owner) === String(user?.id);
    return (
      <div key={a._id} className={`panel flex flex-col p-4 ${a.enabled ? '' : 'opacity-60'}`}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet/15 text-violet-soft"><I size={19} /></div>
          <div className="min-w-0 flex-1"><h3 className="truncate font-display text-sm font-semibold text-white">{a.name}</h3><p className="mt-0.5 text-xs text-zinc-500">{a.builtIn ? 'Built in' : 'Custom'}{a.role === 'system' ? ' · runs automatically' : ''}</p></div>
          {mine && <Toggle checked={a.enabled} onChange={() => toggle(a)} label={`${a.enabled ? 'Disable' : 'Enable'} ${a.name}`} />}
        </div>
        <p className="mt-3 flex-1 text-sm text-zinc-400">{a.description || 'No description.'}</p>
        {a.supportedTasks?.length > 0 && <div className="mt-3 flex flex-wrap gap-1">{a.supportedTasks.slice(0, 4).map((t) => <span key={t} className="chip">{t}</span>)}</div>}
        <div className="mt-4 flex items-center gap-1">
          {a.role === 'worker' && a.enabled && <button className="btn-outline !py-1.5 text-xs" onClick={() => use(a)}><MessageSquarePlus size={14} />Chat with this agent</button>}
          <div className="ml-auto flex">
            {mine && <><button className="icon-btn" onClick={() => setForm(a)} aria-label={`Edit ${a.name}`}><Pencil size={15} /></button><button className="icon-btn hover:!text-red-400" onClick={() => remove(a)} aria-label={`Delete ${a.name}`}><Trash2 size={15} /></button></>}
            {!mine && user?.role === 'admin' && a.builtIn && <button className="icon-btn" onClick={() => setForm(a)} aria-label={`Edit ${a.name} (admin)`}><Pencil size={15} /></button>}
            {!mine && !(user?.role === 'admin' && a.builtIn) && <span className="icon-btn pointer-events-none" title="Built-in agents are read-only"><Lock size={14} /></span>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <PageShell title="Explore agents" subtitle="Specialists the router can choose from. Create your own with a custom system prompt and it joins automatic routing too."
      actions={<button className="btn-primary" onClick={() => setForm('new')}><Plus size={16} />Create agent</button>}>
      {loading ? <div className="flex justify-center py-20 text-zinc-400"><Spinner size={22} /></div> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{worker.map(card)}</div>
          <h2 className="mb-3 mt-10 font-display text-sm font-semibold text-zinc-300">Evaluation agents</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{system.map(card)}</div>
        </>
      )}
      <Modal open={Boolean(form)} onClose={() => setForm(null)} title={form && form !== 'new' ? `Edit ${form.name}` : 'Create a custom agent'}>
        {form && <AgentForm key={form._id || 'new'} initial={form === 'new' ? null : form} onClose={() => setForm(null)} onSaved={() => { setForm(null); refresh(); }} />}
      </Modal>
    </PageShell>
  );
}
