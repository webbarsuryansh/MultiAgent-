import { useEffect, useState } from 'react';
import { BarChart3, Zap, Coins, MessagesSquare } from 'lucide-react';
import { PageShell, Spinner, Empty } from '../components/ui';
import { api, errMsg } from '../services/api';
import { compact, money, secs, providerLabel } from '../utils/format';
import { toast } from '../store/useToast';

const Stat = ({ icon: I, label, value }) => (
  <div className="panel p-4"><div className="flex items-center gap-2 text-sm text-zinc-400"><I size={15} className="text-violet-soft" />{label}</div><p className="mt-2 font-display text-2xl font-semibold text-white">{value}</p></div>
);

function Table({ title, rows, label = (n) => n }) {
  if (!rows.length) return null;
  return (
    <section className="panel overflow-hidden"><h3 className="border-b border-line px-4 py-3 font-display text-sm font-semibold text-white">{title}</h3>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-xs text-zinc-500"><tr><th className="px-4 py-2 font-medium">Name</th><th className="px-4 py-2 font-medium">Calls</th><th className="px-4 py-2 font-medium">Tokens</th><th className="px-4 py-2 font-medium">Est. cost</th><th className="px-4 py-2 font-medium">Avg time</th></tr></thead>
        <tbody className="divide-y divide-line">{rows.map((r) => <tr key={r.name} className="text-zinc-300"><td className="px-4 py-2">{label(r.name)}</td><td className="px-4 py-2 tabular-nums">{r.calls}</td><td className="px-4 py-2 tabular-nums">{compact(r.tokens)}</td><td className="px-4 py-2 tabular-nums">{money(r.cost)}</td><td className="px-4 py-2 tabular-nums">{secs(r.avgLatencyMs)}</td></tr>)}</tbody></table></div></section>
  );
}

export default function UsagePage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  useEffect(() => { setData(null); api.get('/users/usage', { params: { days } }).then((r) => setData(r.data)).catch((e) => { toast.error(errMsg(e)); setData({ empty: true, totals: {}, byDay: [], byProvider: [], byAgent: [], byModel: [] }); }); }, [days]);
  const max = Math.max(1, ...(data?.byDay || []).map((d) => d.tokens));

  return (
    <PageShell title="Usage dashboard" subtitle="Requests, tokens and estimated spend across your agents and models."
      actions={<select aria-label="Time range" className="field !w-auto !py-1.5" value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select>}>
      {!data ? <div className="flex justify-center py-24 text-zinc-400"><Spinner size={22} /></div> : data.totals.modelCalls === 0 || data.empty ? <Empty icon={BarChart3} title="No usage yet">Send your first prompt and your tokens and costs will appear here.</Empty> : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3"><Stat icon={MessagesSquare} label="Prompts" value={data.totals.prompts} /><Stat icon={Zap} label="Tokens" value={compact(data.totals.tokens)} /><Stat icon={Coins} label="Estimated cost" value={money(data.totals.cost)} /></div>
          <section className="panel p-4"><h3 className="mb-4 font-display text-sm font-semibold text-white">Tokens per day</h3>
            <div className="flex h-40 items-end gap-1.5" role="img" aria-label="Bar chart of tokens per day">
              {data.byDay.map((d) => <div key={d.name} className="group relative flex h-full min-w-2 flex-1 items-end"><div className="w-full rounded-t-md bg-gradient-to-t from-violet to-cyan" style={{ height: `${Math.max(4, (d.tokens / max) * 100)}%` }} /><span className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-raised px-2 py-1 text-xs text-zinc-200 group-hover:block">{d.name}: {compact(d.tokens)}</span></div>)}
            </div></section>
          <div className="grid gap-6 lg:grid-cols-2"><Table title="By provider" rows={data.byProvider} label={providerLabel} /><Table title="By model" rows={data.byModel} /></div>
          <Table title="By agent" rows={data.byAgent} />
          <p className="text-xs text-zinc-500">{data.note}</p>
        </div>
      )}
    </PageShell>
  );
}
