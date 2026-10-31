import { Modal } from './ui';
import Markdown from './Markdown';
import ScoreRing from './ScoreRing';
import { secs } from '../utils/format';

export default function CompareModal({ open, onClose, agents }) {
  return (
    <Modal open={open} onClose={onClose} title="Side-by-side comparison" wide>
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(agents.length, 3)}, minmax(0, 1fr))` }}>
        {agents.map((a) => (
          <section key={a.key} className="min-w-0 rounded-xl border border-line bg-ink">
            <div className="flex items-center gap-3 border-b border-line p-3">
              <div className="min-w-0 flex-1"><h3 className="truncate font-display text-sm font-semibold text-white">{a.agentName}</h3><p className="truncate text-xs text-zinc-400">{a.modelName} · {secs(a.latencyMs)}</p></div>
              {a.evaluation && <ScoreRing value={a.evaluation.overall} size={34} />}
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-3"><Markdown>{a.content}</Markdown></div>
          </section>
        ))}
      </div>
    </Modal>
  );
}
