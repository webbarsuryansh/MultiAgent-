import { useEffect, useState } from 'react';
import { ExternalLink, ShieldCheck, Trash2, CheckCircle2 } from 'lucide-react';
import { PageShell, Spinner } from '../components/ui';
import { api, errMsg } from '../services/api';
import { useData } from '../store/useData';
import { toast } from '../store/useToast';

function ProviderRow({ p, saved, onChange }) {
  const [val, setVal] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.post('/keys', { provider: p.id, key: val }); setVal(''); toast.success(`${p.label} key saved`); await onChange(); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  const del = async () => { if (!confirm(`Remove your ${p.label} key?`)) return; try { await api.delete(`/keys/${saved._id}`); toast.success('Key removed'); await onChange(); } catch (err) { toast.error(errMsg(err)); } };

  return (
    <li className="panel p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="font-display text-sm font-semibold text-white">{p.label}</h3>
        {saved && <span className="chip !border-emerald-500/30 !text-emerald-300"><CheckCircle2 size={11} />Your key ending {saved.last4}</span>}
        {!saved && p.serverKey && <span className="chip !text-cyan-soft">Provided by the server</span>}
        {p.keyless && <span className="chip">{p.localEnabled ? 'Local server enabled' : 'Local server off'}</span>}
        <a href={p.docs} target="_blank" rel="noreferrer noopener" className="ml-auto inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white">{p.keyless ? 'Get Ollama' : 'Get a key'}<ExternalLink size={12} /></a>
      </div>
      {p.keyless ? (
        <p className="mt-3 text-sm text-zinc-400">Ollama needs no key. Run <code className="rounded bg-white/10 px-1.5 font-mono text-xs">ollama serve</code>, pull a model, and ask the server admin to set <code className="rounded bg-white/10 px-1.5 font-mono text-xs">OLLAMA_ENABLED=true</code>.</p>
      ) : (
        <form onSubmit={save} className="mt-3 flex flex-wrap gap-2">
          <label className="sr-only" htmlFor={`k-${p.id}`}>{p.label} API key</label>
          <input id={`k-${p.id}`} type="password" autoComplete="off" spellCheck={false} className="field min-w-0 flex-1 basis-64 font-mono" placeholder={saved ? 'Paste a new key to replace it' : 'Paste your API key'} value={val} onChange={(e) => setVal(e.target.value)} minLength={8} required />
          <button className="btn-primary" disabled={busy || val.length < 8}>{busy && <Spinner />}{saved ? 'Replace' : 'Save key'}</button>
          {saved && <button type="button" className="btn-danger" onClick={del}><Trash2 size={15} />Remove</button>}
        </form>
      )}
    </li>
  );
}

export default function KeysPage() {
  const [providers, setProviders] = useState(null);
  const [keys, setKeys] = useState([]);
  const loadModels = useData((s) => s.loadModels);
  const load = async () => {
    try { const [p, k] = await Promise.all([api.get('/keys/providers'), api.get('/keys')]); setProviders(p.data.providers); setKeys(k.data.keys); loadModels().catch(() => {}); } catch (e) { toast.error(errMsg(e)); setProviders([]); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  return (
    <PageShell title="API settings" subtitle="Bring your own keys. Each key is encrypted before it is stored, used only on the server, and never sent back to your browser.">
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-line bg-card p-4 text-sm text-zinc-300"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-400" /><p>Your key is used only for your own requests. After saving, only the last four characters are ever shown. To change a key, paste a new one.</p></div>
      {!providers ? <div className="flex justify-center py-20 text-zinc-400"><Spinner size={22} /></div> : (
        <ul className="space-y-3">{providers.map((p) => <ProviderRow key={p.id} p={p} saved={keys.find((k) => k.provider === p.id)} onChange={load} />)}</ul>
      )}
    </PageShell>
  );
}
