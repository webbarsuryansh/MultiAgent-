import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Activity, CheckCircle2, XCircle, KeyRound } from 'lucide-react';
import { PageShell, Modal, Toggle, Spinner } from '../components/ui';
import { useData } from '../store/useData';
import { useAuth } from '../store/useAuth';
import { api, errMsg } from '../services/api';
import { providerLabel, PROVIDER_LABELS } from '../utils/format';
import { toast } from '../store/useToast';

const STRATEGIES = [['balanced', 'Balanced', 'A mix of quality, speed and cost'], ['quality', 'Best quality', 'Prefer the strongest models'], ['speed', 'Fastest', 'Prefer low-latency models'], ['cost', 'Lowest cost', 'Prefer cheap or local models']];
const CAPS = ['chat', 'code', 'math', 'reasoning', 'creative', 'vision', 'long-context'];

function Preferences() {
  const { user, setUser } = useAuth();
  const p = user.preferences;
  const [f, setF] = useState({ ...p, timeoutSec: Math.round(p.timeoutMs / 1000), maxCostPer1M: p.maxCostPer1M ?? '' });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const num = (k) => (e) => set(k, e.target.value === '' ? '' : Number(e.target.value));
  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.put('/users/preferences', { selectionStrategy: f.selectionStrategy, maxTokens: Number(f.maxTokens), timeoutMs: Number(f.timeoutSec) * 1000, maxAgents: Number(f.maxAgents), collaborationRounds: Number(f.collaborationRounds), maxCostPer1M: f.maxCostPer1M === '' ? null : Number(f.maxCostPer1M), enableCritic: f.enableCritic, enableSynthesizer: f.enableSynthesizer });
      setUser(data.user); toast.success('Preferences saved');
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <section className="panel p-5">
      <h2 className="font-display text-base font-semibold text-white">Selection preferences</h2>
      <p className="mt-1 text-sm text-zinc-400">How the system picks models, and the limits it respects.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" role="radiogroup" aria-label="Model selection strategy">
        {STRATEGIES.map(([id, l, h]) => (
          <button key={id} role="radio" aria-checked={f.selectionStrategy === id} onClick={() => set('selectionStrategy', id)} className={`rounded-xl border p-3 text-left transition ${f.selectionStrategy === id ? 'border-violet bg-violet/10' : 'border-line hover:border-zinc-600'}`}>
            <span className="block text-sm font-semibold text-white">{l}</span><span className="mt-0.5 block text-xs text-zinc-400">{h}</span>
          </button>
        ))}
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div><label className="label" htmlFor="mt">Max response tokens</label><input id="mt" type="number" className="field" min={100} max={8000} step={100} value={f.maxTokens} onChange={num('maxTokens')} /></div>
        <div><label className="label" htmlFor="to">Timeout (seconds)</label><input id="to" type="number" className="field" min={5} max={180} value={f.timeoutSec} onChange={num('timeoutSec')} /></div>
        <div><label className="label" htmlFor="ma">Max agents per prompt</label><input id="ma" type="number" className="field" min={1} max={6} value={f.maxAgents} onChange={num('maxAgents')} /></div>
        <div><label className="label" htmlFor="cr">Collaboration rounds</label><input id="cr" type="number" className="field" min={1} max={3} value={f.collaborationRounds} onChange={num('collaborationRounds')} /></div>
        <div><label className="label" htmlFor="mc">Cost ceiling ($ per 1M tokens, average)</label><input id="mc" type="number" className="field" min={0} step={0.1} placeholder="No limit" value={f.maxCostPer1M} onChange={num('maxCostPer1M')} /></div>
        <div className="flex flex-col justify-end gap-3 pb-1">
          <label className="flex items-center justify-between gap-3 text-sm text-zinc-300">Critic scores answers<Toggle checked={f.enableCritic} onChange={(v) => set('enableCritic', v)} label="Critic scoring" /></label>
          <label className="flex items-center justify-between gap-3 text-sm text-zinc-300">Synthesize final answer<Toggle checked={f.enableSynthesizer} onChange={(v) => set('enableSynthesizer', v)} label="Final synthesis" /></label>
        </div>
      </div>
      <div className="mt-5 flex justify-end"><button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner />}Save preferences</button></div>
    </section>
  );
}

function AddModel({ onDone }) {
  const [f, setF] = useState({ name: '', provider: 'openrouter', modelId: '', contextWindow: 128000, qualityTier: 2, speedTier: 2, inputPer1M: 0, outputPer1M: 0, capabilities: ['chat'] });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await api.post('/models/configure', { model: { name: f.name, provider: f.provider, modelId: f.modelId, capabilities: f.capabilities, contextWindow: Number(f.contextWindow), qualityTier: Number(f.qualityTier), speedTier: Number(f.speedTier), pricingInformation: { inputPer1M: Number(f.inputPer1M), outputPer1M: Number(f.outputPer1M) } } });
      toast.success('Model saved'); onDone();
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="mn">Display name</label><input id="mn" className="field" required value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div><label className="label" htmlFor="mp">Provider</label><select id="mp" className="field" value={f.provider} onChange={(e) => set('provider', e.target.value)}>{Object.entries(PROVIDER_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      </div>
      <div><label className="label" htmlFor="mi">Model ID (exactly as the provider names it)</label><input id="mi" className="field font-mono" required value={f.modelId} onChange={(e) => set('modelId', e.target.value)} placeholder="e.g. deepseek/deepseek-chat" /></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div><label className="label" htmlFor="mc2">Context window</label><input id="mc2" type="number" className="field" value={f.contextWindow} onChange={(e) => set('contextWindow', e.target.value)} /></div>
        <div><label className="label" htmlFor="ip">Input $ / 1M tokens</label><input id="ip" type="number" step="0.01" min="0" className="field" value={f.inputPer1M} onChange={(e) => set('inputPer1M', e.target.value)} /></div>
        <div><label className="label" htmlFor="op">Output $ / 1M tokens</label><input id="op" type="number" step="0.01" min="0" className="field" value={f.outputPer1M} onChange={(e) => set('outputPer1M', e.target.value)} /></div>
        <div><label className="label" htmlFor="qt">Quality (1-3)</label><input id="qt" type="number" min="1" max="3" className="field" value={f.qualityTier} onChange={(e) => set('qualityTier', e.target.value)} /></div>
        <div><label className="label" htmlFor="st">Speed (1-3)</label><input id="st" type="number" min="1" max="3" className="field" value={f.speedTier} onChange={(e) => set('speedTier', e.target.value)} /></div>
      </div>
      <fieldset><legend className="label">Capabilities</legend><div className="flex flex-wrap gap-2">{CAPS.map((c) => { const on = f.capabilities.includes(c); return <button type="button" key={c} aria-pressed={on} onClick={() => set('capabilities', on ? f.capabilities.filter((x) => x !== c) : [...f.capabilities, c])} className={`chip cursor-pointer ${on ? '!border-violet !text-violet-soft' : ''}`}>{c}</button>; })}</div></fieldset>
      <div className="flex justify-end"><button className="btn-primary" disabled={busy}>{busy && <Spinner />}Save model</button></div>
    </form>
  );
}

export default function ModelsPage() {
  const { models, agents, loadModels, loadAgents } = useData();
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(!models.length);
  const [checks, setChecks] = useState({});
  const [adding, setAdding] = useState(false);
  const refresh = () => Promise.all([loadModels(), loadAgents()]).catch((e) => toast.error(errMsg(e))).finally(() => setLoading(false));
  useEffect(() => { refresh(); }, []); // eslint-disable-line

  const groups = useMemo(() => models.reduce((acc, m) => { (acc[m.provider] ||= []).push(m); return acc; }, {}), [models]);
  const usable = models.filter((m) => m.usable);

  const toggle = async (m, enabled) => { try { await api.post('/models/configure', { id: m._id, enabled }); await loadModels(); } catch (e) { toast.error(errMsg(e)); } };
  const check = async (m) => {
    setChecks((c) => ({ ...c, [m._id]: { busy: true } }));
    try { const { data } = await api.post(`/models/${m._id}/check`, null, { timeout: 30000 }); setChecks((c) => ({ ...c, [m._id]: data })); } catch (e) { setChecks((c) => ({ ...c, [m._id]: { ok: false, error: errMsg(e) } })); }
  };
  const setPreferred = async (agentKey, modelId) => {
    try { const { data } = await api.put('/users/preferences', { agentModels: { [agentKey]: modelId } }); setUser(data.user); toast.success('Saved'); } catch (e) { toast.error(errMsg(e)); }
  };

  if (loading) return <div className="flex justify-center py-24 text-zinc-400"><Spinner size={22} /></div>;
  const prefs = user.preferences.agentModels || {};

  return (
    <PageShell title="Model selection" subtitle="Turn models on or off, test them, and decide which model each agent prefers."
      actions={user.role === 'admin' && <button className="btn-outline" onClick={() => setAdding(true)}><Plus size={16} />Add model</button>}>
      <div className="space-y-8">
        <Preferences />

        <section>
          <h2 className="mb-3 font-display text-base font-semibold text-white">Available models <span className="ml-1 text-sm font-normal text-zinc-500">{usable.length} ready to use</span></h2>
          {usable.length === 0 && <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-100"><KeyRound size={18} className="mt-0.5 shrink-0" /><span>No models are ready yet. <Link to="/keys" className="font-semibold underline">Add an API key</Link> for at least one provider (Gemini or OpenRouter is the quickest start).</span></div>}
          <div className="space-y-5">
            {Object.entries(groups).map(([prov, list]) => (
              <div key={prov} className="panel overflow-hidden">
                <div className="flex items-center justify-between border-b border-line px-4 py-2.5"><h3 className="font-display text-sm font-semibold text-white">{providerLabel(prov)}</h3>
                  <span className={`text-xs ${list[0].hasCredentials ? 'text-emerald-300' : 'text-zinc-500'}`}>{list[0].hasCredentials ? `Key: ${list[0].credentialSource === 'user' ? 'yours' : list[0].credentialSource === 'server' ? 'provided by the server' : 'local'}` : 'No API key'}</span></div>
                <ul className="divide-y divide-line">
                  {list.map((m) => { const c = checks[m._id]; return (
                    <li key={m._id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                      <div className="min-w-0 flex-1 basis-56"><p className="truncate text-sm font-semibold text-zinc-100">{m.name}</p><p className="truncate font-mono text-xs text-zinc-500">{m.modelId}</p></div>
                      <div className="flex flex-wrap gap-1 basis-56 flex-1">{m.capabilities.slice(0, 5).map((cp) => <span key={cp} className="chip">{cp}</span>)}</div>
                      <div className="w-40 text-xs text-zinc-500"><p>{Math.round(m.contextWindow / 1000)}k context</p><p>${m.pricingInformation.inputPer1M} in / ${m.pricingInformation.outputPer1M} out per 1M</p></div>
                      <div className="flex items-center gap-2">
                        {c?.busy ? <Spinner size={15} className="text-cyan-soft" /> : c ? (c.ok ? <span className="inline-flex items-center gap-1 text-xs text-emerald-300"><CheckCircle2 size={14} />{(c.latencyMs / 1000).toFixed(1)}s</span> : <span className="inline-flex max-w-44 items-center gap-1 truncate text-xs text-red-300" title={c.error}><XCircle size={14} className="shrink-0" />{c.error}</span>) : null}
                        <button className="icon-btn" onClick={() => check(m)} disabled={!m.hasCredentials || c?.busy} aria-label={`Test ${m.name}`} title={m.hasCredentials ? 'Send a tiny test request' : 'Add an API key to test'}><Activity size={16} /></button>
                        <Toggle checked={m.enabledForUser} onChange={(v) => toggle(m, v)} label={`${m.enabledForUser ? 'Disable' : 'Enable'} ${m.name}`} />
                      </div>
                    </li>); })}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-base font-semibold text-white">Preferred model per agent</h2>
          <p className="mt-1 text-sm text-zinc-400">Leave on Automatic to let the selector decide. Your pick is used first, with automatic fallback if it fails.</p>
          <div className="mt-4 grid gap-x-6 gap-y-3 md:grid-cols-2">
            {agents.map((a) => (
              <div key={a._id} className="flex items-center gap-3"><label htmlFor={`pm-${a.key}`} className="w-40 shrink-0 truncate text-sm text-zinc-300">{a.name}</label>
                <select id={`pm-${a.key}`} className="field !py-1.5" value={prefs[a.key] || ''} onChange={(e) => setPreferred(a.key, e.target.value)}>
                  <option value="">Automatic</option>{usable.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
                </select></div>
            ))}
          </div>
        </section>
      </div>
      <Modal open={adding} onClose={() => setAdding(false)} title="Add or update a model"><AddModel onDone={() => { setAdding(false); loadModels(); }} /></Modal>
    </PageShell>
  );
}
