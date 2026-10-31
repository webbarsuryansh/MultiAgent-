import { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';

const textOf = (node) => (typeof node === 'string' ? node : Array.isArray(node) ? node.map(textOf).join('') : node?.props ? textOf(node.props.children) : '');

function Pre({ children }) {
  const [done, setDone] = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(textOf(children).replace(/\n$/, '')); setDone(true); setTimeout(() => setDone(false), 1500); };
  return (
    <div className="group relative">
      <pre>{children}</pre>
      <button onClick={copy} aria-label="Copy code" className="icon-btn absolute right-2 top-2 bg-card/90 opacity-0 transition group-hover:opacity-100 focus:opacity-100">
        {done ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function Markdown({ children, streaming = false }) {
  return (
    <div className={`md ${streaming ? 'caret' : ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: Pre, a: (p) => <a {...p} target="_blank" rel="noreferrer noopener" /> }}>{children || ''}</ReactMarkdown>
    </div>
  );
}
export default memo(Markdown);
