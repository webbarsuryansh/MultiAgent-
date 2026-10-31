import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, RefreshCw, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, Columns2, AlertTriangle, Clock, Award, ArrowRightLeft } from 'lucide-react';
import { agentIcon } from '../utils/icons';
import { secs, compact, money, providerLabel } from '../utils/format';
import Markdown from './Markdown';
import ScoreRing, { tone } from './ScoreRing';
import { Spinner } from './ui';
import { toast } from '../store/useToast';

const STATUS = {
  queued: { label: 'Queued', cls: 'text-zinc-400 border-line' },
  running: { label: 'Running', cls: 'text-cyan-soft border-cyan/40' },
  completed: { label: 'Completed', cls: 'text-emerald-300 border-emerald-500/30' },
  failed: { label: 'Failed', cls: 'text-red-300 border-red-500/30' },
  cancelled: { label: 'Stopped', cls: 'text-zinc-400 border-line' },
};
const VOTES = [['best', 'Best'], ['detailed', 'Most detailed'], ['creative', 'Most creative'], ['accurate', 'Most accurate']];
const CRITERIA = { accuracy: 'Accuracy', relevance: 'Relevance', completeness: 'Completeness', clarity: 'Clarity', reasoning: 'Reasoning', instruction: 'Instruction adherence' };

export default function AgentCard({ turn, agent, canAct, onRegenerate, onFeedback, onVote, comparing, onCompare }) {
  const [open, setOpen] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const [voteMenu, setVoteMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const Icon = agentIcon(agent.icon);
  const st = STATUS[agent.status] || STATUS.queued;
  const running = agent.status === 'running';
  const long = (agent.content?.length || 0) > 700;
  const collapsed = long && !open && !running;
  const ev = agent.evaluation;
  const myVotes = VOTES.filter(([k]) => turn.votes?.[k] === agent.key);
  const tokens = (agent.tokens?.input || 0) + (agent.tokens?.output || 0);

  const copy = async () => { await navigator.clipboard.writeText(agent.content || ''); setCopied(true); toast.success('Response copied'); setTimeout(() => setCopied(false), 1500); };

  return (
    <motion.article layout="position" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`panel relative flex min-w-0 flex-col ${running ? 'running-glow' : ''} ${comparing ? 'ring-2 ring-cyan/60' : ''}`} aria-label={`${agent.agentName} response`}>
      <header className="flex items-start gap-3 p-4 pb-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet/15 text-violet-soft"><Icon size={18} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="truncate font-display text-sm font-semibold text-white">{agent.agentName}</h3>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${st.cls}`}>{running && <Spinner size={10} />}{st.label}</span>
            {agent.round > 1 && <span className="chip">Round {agent.round}</span>}
            {agent.fallback && <span className="chip text-amber-300" title="The first model failed, so a fallback model answered"><ArrowRightLeft size={11} />Fallback</span>}
            {myVotes.map(([k, l]) => <span key={k} className="chip border-violet/40 text-violet-soft"><Award size={11} />{l}</span>)}
          </div>
          <p className="mt-0.5 truncate text-xs text-zinc-400">{agent.modelName || '—'} <span className="text-zinc-600">·</span> {agent.providerLabel || providerLabel(agent.provider)}</p>
        </div>
        {ev && <ScoreRing value={ev.overall} onClick={() => setShowScore((v) => !v)} active={showScore} />}
      </header>

      {showScore && ev && (
        <div className="mx-4 mb-3 rounded-xl border border-line bg-ink p-3 text-sm">
          <div className="grid grid-cols-1 gap-x-5 gap-y-1.5 sm:grid-cols-2">
            {Object.entries(CRITERIA).map(([k, label]) => (
              <div key={k} className="flex items-center gap-2 text-xs">
                <span className="w-32 shrink-0 text-zinc-400">{label}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full" style={{ width: `${ev.scores?.[k] ?? 0}%`, background: tone(ev.scores?.[k] ?? 0) }} /></div>
                <span className="w-7 text-right tabular-nums text-zinc-300">{ev.scores?.[k] ?? 0}</span>
              </div>
            ))}
          </div>
          {ev.explanation && <p className="mt-3 text-zinc-300">{ev.explanation}</p>}
          {ev.issues?.length > 0 && <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-amber-300/90">{ev.issues.map((i, n) => <li key={n}>{i}</li>)}</ul>}
          <p className="mt-3 text-[11px] text-zinc-500">Scored by an AI critic. This is an opinion, not proof of accuracy. Check important facts yourself.</p>
        </div>
      )}

      <div className="relative px-4 pb-3">
        {agent.status === 'failed' ? (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-200"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>{agent.error || 'This agent could not answer.'} Other agents are unaffected.</span></div>
        ) : !agent.content && (agent.status === 'queued' || running) ? (
          <p className="py-3 text-sm text-zinc-500">{agent.status === 'queued' ? 'Waiting for a free slot…' : 'Thinking…'}</p>
        ) : agent.status === 'cancelled' && !agent.content ? (
          <p className="py-3 text-sm text-zinc-500">Stopped before this agent answered.</p>
        ) : (
          <div className={collapsed ? 'max-h-52 overflow-hidden' : ''}>
            <Markdown streaming={running}>{agent.content}</Markdown>
          </div>
        )}
        {collapsed && <div className="pointer-events-none absolute inset-x-4 bottom-3 h-16 bg-gradient-to-t from-card to-transparent" />}
      </div>

      <footer className="mt-auto flex flex-wrap items-center gap-1 border-t border-line px-3 py-2">
        <button className="icon-btn" onClick={copy} disabled={!agent.content} aria-label="Copy response">{copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}</button>
        <button className="icon-btn" onClick={onRegenerate} disabled={!canAct || running || !turn.messageId} aria-label="Regenerate this response" title="Regenerate"><RefreshCw size={15} /></button>
        <button className={`icon-btn ${agent.feedback === 'like' ? '!text-emerald-400' : ''}`} onClick={() => onFeedback('like')} disabled={!turn.messageId || !agent.content} aria-label="Like" aria-pressed={agent.feedback === 'like'}><ThumbsUp size={15} /></button>
        <button className={`icon-btn ${agent.feedback === 'dislike' ? '!text-red-400' : ''}`} onClick={() => onFeedback('dislike')} disabled={!turn.messageId || !agent.content} aria-label="Dislike" aria-pressed={agent.feedback === 'dislike'}><ThumbsDown size={15} /></button>
        <div className="relative">
          <button className="icon-btn" onClick={() => setVoteMenu((v) => !v)} disabled={!turn.messageId || agent.status !== 'completed'} aria-label="Mark this response" aria-expanded={voteMenu} title="Mark as best, detailed, creative or accurate"><Award size={15} /></button>
          {voteMenu && (
            <div className="absolute bottom-9 left-0 z-20 w-44 rounded-xl border border-line bg-raised p-1 shadow-2xl" onMouseLeave={() => setVoteMenu(false)}>
              {VOTES.map(([k, l]) => (
                <button key={k} onClick={() => { onVote(k); setVoteMenu(false); }} className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm text-zinc-200 hover:bg-white/5">
                  {l}{turn.votes?.[k] === agent.key && <Check size={14} className="text-violet-soft" />}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className={`icon-btn ${comparing ? '!text-cyan-soft' : ''}`} onClick={onCompare} disabled={agent.status !== 'completed'} aria-label="Add to side-by-side comparison" aria-pressed={comparing} title="Compare side by side"><Columns2 size={15} /></button>
        {long && !running && <button className="icon-btn" onClick={() => setOpen((v) => !v)} aria-label={open ? 'Collapse' : 'Expand'}>{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>}
        <div className="ml-auto flex items-center gap-3 pr-1 text-[11px] text-zinc-500">
          {agent.latencyMs != null && <span className="inline-flex items-center gap-1"><Clock size={11} />{secs(agent.latencyMs)}</span>}
          {tokens > 0 && <span title={`${agent.tokens.input} in / ${agent.tokens.output} out${agent.tokens.estimated ? ' (estimated)' : ''}${agent.cost ? ` · ${money(agent.cost)}` : ''}`}>{agent.tokens.estimated ? '~' : ''}{compact(tokens)} tok</span>}
        </div>
      </footer>
    </motion.article>
  );
}
