import { useState } from 'react';
import { motion } from 'framer-motion';
import { Route, Layers, Paperclip, Copy, Square, Columns2, AlertTriangle, Scale, Merge, Swords, Users } from 'lucide-react';
import AgentCard from './AgentCard';
import CompareModal from './CompareModal';
import Markdown from './Markdown';
import { Spinner } from './ui';
import { useChat } from '../store/useChat';
import { providerLabel } from '../utils/format';
import { toast } from '../store/useToast';

const MODE_LABEL = { parallel: 'Parallel', collab: 'Collaboration', arena: 'Model arena' };

function Routing({ turn }) {
  const r = turn.routing;
  if (!r) return <div className="flex items-center gap-2 text-sm text-zinc-400"><Spinner size={14} className="text-cyan-soft" />Reading your prompt and choosing agents…</div>;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-zinc-400">
      <span className="inline-flex items-center gap-1.5 text-zinc-300">{turn.mode === 'arena' ? <Swords size={14} /> : turn.mode === 'collab' ? <Users size={14} /> : <Route size={14} />}{MODE_LABEL[turn.mode]}</span>
      {r.complexity && <span className="chip">{r.complexity} complexity</span>}
      {r.domain && r.domain !== 'general' && <span className="chip">{r.domain}</span>}
      <span className="min-w-0 flex-1 basis-64 text-zinc-500">{r.reasoning}</span>
      {turn.round && turn.totalRounds > 1 && turn.status === 'running' && <span className="chip border-cyan/40 text-cyan-soft">Round {turn.round} of {turn.totalRounds}</span>}
      {turn.earlyStop && <span className="chip">Agents agreed after round {turn.earlyStop - 1}, so refining stopped early</span>}
    </div>
  );
}

function FinalAnswer({ turn }) {
  const f = turn.final;
  const evaluating = turn.evalState === 'running';
  if (!f && !evaluating) return null;
  const copy = async () => { await navigator.clipboard.writeText(f.content); toast.success('Final answer copied'); };
  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-gradient-to-br from-violet/70 via-line to-cyan/60 p-px" aria-label="Final synthesized answer">
      <div className="rounded-[15px] bg-card p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Merge size={16} className="text-violet-soft" />
          <h3 className="font-display text-sm font-semibold text-white">Final answer</h3>
          {f?.model && <span className="chip">{f.model}{f.provider ? ` · ${providerLabel(f.provider)}` : ''}</span>}
          {f?.status === 'running' && <span className="chip text-cyan-soft"><Spinner size={10} />Synthesizing</span>}
          {f?.content && <button className="icon-btn ml-auto" onClick={copy} aria-label="Copy final answer"><Copy size={15} /></button>}
        </div>
        {evaluating && !f && <p className="flex items-center gap-2 text-sm text-zinc-400"><Scale size={14} />The critic is scoring each answer before they are merged…</p>}
        {f?.status === 'failed' && <p className="flex items-start gap-2 text-sm text-red-200"><AlertTriangle size={16} className="mt-0.5 shrink-0" />The synthesizer could not finish: {f.error}. The individual answers below are still available.</p>}
        {f?.content && <Markdown streaming={f.status === 'running'}>{f.content}</Markdown>}
        {turn.evalSummary && (
          <div className="mt-4 rounded-xl border border-line bg-ink p-3 text-sm text-zinc-400"><span className="font-semibold text-zinc-300">Critic summary{turn.judge ? ` (${turn.judge})` : ''}: </span>{turn.evalSummary}</div>
        )}
      </div>
    </motion.section>
  );
}

export default function TurnView({ turn }) {
  const { regenerate, feedback, vote, cancel } = useChat();
  const [picked, setPicked] = useState([]);
  const [cmpOpen, setCmpOpen] = useState(false);
  const running = turn.status === 'running';
  const agents = turn.order.map((k) => turn.agents[k]).filter(Boolean);
  const togglePick = (k) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k].slice(-3)));
  const cols = agents.length === 1 ? 'grid-cols-1' : agents.length === 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3';

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="max-w-[min(100%,46rem)] rounded-2xl rounded-tr-md border border-violet/30 bg-violet/10 px-4 py-3 text-[15px] text-zinc-100">
          <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{turn.prompt}</p>
          {turn.attachments?.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{turn.attachments.map((a, i) => <span key={i} className="chip"><Paperclip size={11} />{a.name}</span>)}</div>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1"><Routing turn={turn} /></div>
        {running && <button className="btn-outline !py-1.5" onClick={() => cancel(turn.id)}><Square size={13} fill="currentColor" />Stop</button>}
      </div>

      {turn.status === 'error' && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/5 p-3.5 text-sm text-red-200"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{turn.error}</div>}
      {turn.status === 'cancelled' && <p className="text-sm text-zinc-500">You stopped this run. Anything already generated was kept.</p>}

      <FinalAnswer turn={turn} />

      {agents.length > 0 && (
        <>
          {picked.length >= 2 && (
            <div className="sticky top-2 z-10 flex items-center justify-between gap-3 rounded-xl border border-cyan/40 bg-raised/95 px-4 py-2.5 shadow-neon-cyan backdrop-blur">
              <span className="text-sm text-zinc-200">{picked.length} responses selected</span>
              <div className="flex gap-2"><button className="btn-ghost !py-1" onClick={() => setPicked([])}>Clear</button><button className="btn-primary !py-1.5" onClick={() => setCmpOpen(true)}><Columns2 size={15} />Compare</button></div>
            </div>
          )}
          <div className={`grid items-start gap-4 ${cols}`}>
            {agents.map((a) => (
              <AgentCard key={a.key} turn={turn} agent={a} canAct={!useChat.getState().isBusy()}
                onRegenerate={() => regenerate(turn, a.key)} onFeedback={(v) => feedback(turn, a.key, v)} onVote={(k) => vote(turn, k, a.key)}
                comparing={picked.includes(a.key)} onCompare={() => togglePick(a.key)} />
            ))}
          </div>
          {!running && agents.length > 1 && picked.length < 2 && <p className="flex items-center gap-1.5 text-xs text-zinc-500"><Layers size={12} />Tip: use the compare button on two or three cards to read them side by side.</p>}
        </>
      )}
      <CompareModal open={cmpOpen} onClose={() => setCmpOpen(false)} agents={picked.map((k) => turn.agents[k]).filter(Boolean)} />
    </div>
  );
}
