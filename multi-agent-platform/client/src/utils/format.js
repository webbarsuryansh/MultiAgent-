export const secs = (ms) => (ms == null ? '' : `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s`);
export const compact = (n = 0) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
export const money = (n = 0) => (n === 0 ? '$0' : n < 0.01 ? `<$0.01` : `$${n.toFixed(n < 1 ? 3 : 2)}`);
export const when = (d) => new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export const PROVIDER_LABELS = { gemini: 'Google Gemini', openrouter: 'OpenRouter', openai: 'OpenAI', anthropic: 'Anthropic Claude', groq: 'Groq', deepseek: 'DeepSeek', huggingface: 'Hugging Face', ollama: 'Ollama (local)' };
export const providerLabel = (id) => PROVIDER_LABELS[id] || id || '';
