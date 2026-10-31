import { stream } from './providerAdapters/index.js';
import { ProviderError } from './providerAdapters/errors.js';
import { PROVIDERS } from '../config/providers.js';
import { env } from '../config/env.js';
import { estimateMessages, estimateTokens, computeCost } from '../utils/tokenCounter.js';
import { GUARD, wrap } from '../utils/security.js';

/* ---------- concurrency gate (global, configurable via MAX_CONCURRENT_AGENTS) ---------- */
class Semaphore {
  constructor(n) { this.n = n; this.queue = []; }
  async acquire() { if (this.n > 0) { this.n -= 1; return; } await new Promise((r) => this.queue.push(r)); }
  release() { const next = this.queue.shift(); if (next) next(); else this.n += 1; }
}
const gate = new Semaphore(env.maxConcurrency);

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(new ProviderError('Request cancelled', { cancelled: true })); }, { once: true });
});

/** One model, with timeout + exponential backoff retries on retryable failures. */
async function callModel({ model, cred, messages, maxTokens, timeoutMs, temperature, signal, onToken, onReset }) {
  const attempts = env.retries + 1;
  let last;
  for (let i = 0; i < attempts; i += 1) {
    if (signal?.aborted) throw new ProviderError('Request cancelled', { cancelled: true });
    const combined = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(timeoutMs)]);
    let streamed = false;
    try {
      const r = await stream({
        providerKey: model.provider, apiKey: cred.apiKey, model: model.modelId, messages, maxTokens, temperature,
        signal: combined, onToken: (t) => { streamed = true; onToken?.(t); },
      });
      if (!r.text.trim()) throw new ProviderError('The model returned an empty response', { retryable: true });
      return r;
    } catch (err) {
      last = err;
      if (streamed) onReset?.();
      if (err.cancelled || !err.retryable || i === attempts - 1) throw err;
      await sleep(Math.min(8000, 600 * 2 ** i + Math.random() * 300), signal);
    }
  }
  throw last;
}

/**
 * Try the first candidate, then fall back through the next ones (provider fallback).
 * Returns { text, model, usage: { input, output, estimated }, cost }.
 */
export async function completeWithFallback({ candidates, creds, messages, maxTokens = 1500, timeoutMs = 60000, temperature = 0.7, signal, onToken, onAttempt, onReset, maxFallbacks = 2 }) {
  const list = candidates.slice(0, maxFallbacks + 1);
  let lastErr = new ProviderError('No usable model is available for this step');
  for (let i = 0; i < list.length; i += 1) {
    const model = list[i];
    const cred = creds[model.provider];
    if (!cred) continue;
    onAttempt?.(model, i);
    await gate.acquire();
    try {
      const r = await callModel({ model, cred, messages, maxTokens, timeoutMs, temperature, signal, onToken, onReset });
      const usage = r.usage?.input != null && r.usage?.output != null
        ? { input: r.usage.input, output: r.usage.output, estimated: false }
        : { input: estimateMessages(messages), output: estimateTokens(r.text), estimated: true };
      return { text: r.text, model, usage, cost: computeCost(model.pricingInformation, usage.input, usage.output) };
    } catch (err) {
      lastErr = err;
      if (err.cancelled) throw err;
    } finally {
      gate.release();
    }
  }
  throw lastErr;
}

/* ---------- agent execution ---------- */
const attr = (s) => String(s).replace(/["<>]/g, '');

export function buildAgentMessages({ agent, prompt, history = [], documents = [], images = [], peers = [], ownDraft = '', round = 1 }) {
  const docs = documents.map((d) => wrap('user_document', `name="${attr(d.name)}"`, d.text)).join('\n\n');
  let user = `${docs ? `${docs}\n\n` : ''}${prompt}`;
  if (round > 1) {
    user += `\n\n---\nCOLLABORATION ROUND ${round}.\nYour previous answer:\n${wrap('agent_output', 'by="you"', ownDraft)}\n\nOther agents' answers:\n${peers.map((p) => wrap('agent_output', `by="${attr(p.name)}"`, p.content)).join('\n')}\n\nReview the other answers critically. Challenge incorrect assumptions, adopt what is better, fix mistakes in your own answer, then write your improved answer in full. If you cannot meaningfully improve it, reply with exactly: NO_CHANGES`;
  }
  return [
    { role: 'system', content: `${agent.systemPrompt}\n\n${GUARD}` },
    ...history,
    { role: 'user', content: user, ...(images.length ? { images } : {}) },
  ];
}

/** Run one slot (agent + ranked model candidates). Streams via emit; never throws. */
export async function runSlot({ slot, creds, messages, round = 1, emit, signal, prefs }) {
  const start = Date.now();
  const key = slot.key;
  const base = { key, agentKey: slot.agent.key, agentName: slot.agent.name, icon: slot.agent.icon, round };
  try {
    const r = await completeWithFallback({
      candidates: slot.candidates, creds, messages, signal,
      maxTokens: prefs.maxTokens, timeoutMs: prefs.timeoutMs, temperature: slot.agent.configuration?.temperature ?? 0.7,
      onToken: (token) => emit('agent:token', { key, token }),
      onReset: () => emit('agent:reset', { key }),
      onAttempt: (m, i) => {
        if (i > 0) emit('agent:reset', { key });
        emit('agent:status', { key, status: 'running', round, modelName: m.name, provider: m.provider, providerLabel: PROVIDERS[m.provider]?.label || m.provider, fallback: i > 0 });
      },
    });
    return { ...base, status: 'completed', content: r.text, provider: r.model.provider, model: r.model.modelId, modelName: r.model.name, modelDocId: String(r.model._id), latencyMs: Date.now() - start, tokens: r.usage, cost: r.cost };
  } catch (err) {
    return { ...base, status: err.cancelled ? 'cancelled' : 'failed', content: '', error: err.message, latencyMs: Date.now() - start };
  }
}
